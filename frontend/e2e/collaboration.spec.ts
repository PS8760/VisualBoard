import { test, expect, type Browser, type Page } from '@playwright/test';

/**
 * Multi-user scenarios: two real browser contexts on the same board, talking
 * to the real API + socket server. State is asserted both in the UI and in
 * the API (what a third client / a reload would see).
 */

const API = 'http://localhost:8000/api/v1';

type Session = { token: string; user: { id: number; name: string } };

async function login(email: string): Promise<Session> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!' }),
  });
  expect(res.ok).toBeTruthy();
  return (await res.json()).data;
}

async function api<T = unknown>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  expect(res.ok, `${init.method ?? 'GET'} ${path} → ${res.status}`).toBeTruthy();
  return (await res.json()).data as T;
}

type ElementRow = { id: string; element_data: { x: number; y: number; kind: string; attachment?: { id: string } } };
const elements = (token: string, boardId: number) => api<ElementRow[]>(token, `/boards/${boardId}/elements`);

async function openBoard(browser: Browser, session: Session, boardId: number) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(
    ({ token, session }) => {
      localStorage.setItem('vb_token', token);
      localStorage.setItem('vb_user', JSON.stringify(session));
      localStorage.setItem('vb_onboarding_seen', 'true');
    },
    { token: session.token, session: session.user },
  );
  await page.goto(`/board/${boardId}`);
  await expect(page.getByText('saved', { exact: true })).toBeVisible();
  return { context, page };
}

/** Drag on the canvas between two points relative to the canvas center. */
async function dragOnCanvas(page: Page, from: [number, number], to: [number, number]) {
  const box = (await page.getByLabel('Whiteboard canvas').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx + from[0], cy + from[1]);
  await page.mouse.down();
  await page.mouse.move(cx + (from[0] + to[0]) / 2, cy + (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(cx + to[0], cy + to[1], { steps: 4 });
  await page.mouse.up();
}

async function elementCount(page: Page) {
  const open = page.getByRole('button', { name: 'Open panel' });
  if (await open.isVisible()) await open.click();
  await page.getByRole('tab', { name: /info/i }).click();
  const tile = page.locator('div', { has: page.getByText('Elements', { exact: true }) }).last();
  return Number(await tile.locator('p').nth(1).textContent());
}

test('every fresh board gets its own starter content (no global id collisions)', async ({ browser }) => {
  const owner = await login('owner@example.com');
  for (let i = 0; i < 2; i++) {
    const board = await api<{ id: number }>(owner.token, '/boards', {
      method: 'POST',
      body: JSON.stringify({ title: `Fresh ${Date.now()}-${i}` }),
    });
    const { context, page } = await openBoard(browser, owner, board.id);
    await expect.poll(() => elements(owner.token, board.id).then((r) => r.length)).toBe(6);
    await expect(page.getByText('A change could not be saved')).toHaveCount(0);
    await context.close();
  }
});

test.describe('realtime collaboration', () => {
  let owner: Session;
  let editor: Session;
  let boardId: number;

  test.beforeEach(async () => {
    owner = await login('owner@example.com');
    editor = await login('editor@example.com');
    const board = await api<{ id: number }>(owner.token, '/boards', {
      method: 'POST',
      body: JSON.stringify({ title: `Collab ${Date.now()}` }),
    });
    boardId = board.id;
    await api(owner.token, `/boards/${boardId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId: editor.user.id, role: 'editor' }),
    });
    // Start from a known element so the fresh-board seeding doesn't kick in.
    await api(owner.token, `/boards/${boardId}/elements`, {
      method: 'POST',
      body: JSON.stringify({
        element: { id: `e2e_anchor_${boardId}`, kind: 'rect', x: 300, y: 200, width: 80, height: 60, rotation: 0, fill: '#fafaf8', stroke: '#c2c0b5', strokeWidth: 1.5, content: '' },
      }),
    });
  });

  test('a shape drawn by one user appears live for the other and is persisted once', async ({ browser }) => {
    const a = await openBoard(browser, owner, boardId);
    const b = await openBoard(browser, editor, boardId);

    await a.page.keyboard.press('r');
    await dragOnCanvas(a.page, [-200, -120], [-80, -40]);

    await expect.poll(() => elements(owner.token, boardId).then((r) => r.length)).toBe(2);
    await expect.poll(() => elementCount(b.page)).toBe(2);
    await expect(a.page.getByText('saved', { exact: true })).toBeVisible();

    // B moves the original element with the keyboard-free API path a script
    // would use; A must see the authoritative position without reloading.
    const seed = `e2e_anchor_${boardId}`;
    await api(editor.token, `/boards/${boardId}/elements/${seed}`, {
      method: 'PATCH',
      body: JSON.stringify({ patch: { x: 420 } }),
    });
    await expect.poll(async () => (await elements(owner.token, boardId)).find((e) => e.id === seed)!.element_data.x).toBe(420);

    await a.context.close();
    await b.context.close();
  });

  test('commenting while another user restores a version keeps both changes', async ({ browser }) => {
    const snapshot = await api<{ id: number }>(owner.token, `/boards/${boardId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ label: 'before edits' }),
    });
    const a = await openBoard(browser, owner, boardId);
    const b = await openBoard(browser, editor, boardId);

    // B adds a shape after the snapshot
    await b.page.keyboard.press('r');
    await dragOnCanvas(b.page, [-220, 100], [-120, 160]);
    await expect.poll(() => elements(owner.token, boardId).then((r) => r.length)).toBe(2);
    await expect.poll(() => elementCount(a.page)).toBe(2);

    // B starts a comment thread on the canvas while A restores the snapshot
    await b.page.keyboard.press('c');
    const box = (await b.page.getByLabel('Whiteboard canvas').boundingBox())!;
    await b.page.mouse.click(box.x + box.width / 2 + 150, box.y + box.height / 2 - 150);
    const composer = b.page.getByRole('dialog', { name: 'Comment thread' });
    await composer.getByRole('textbox').fill('Comment during restore');

    await a.page.getByRole('button', { name: /version history/i }).click();
    const timeline = a.page.getByRole('dialog', { name: 'Version history' });
    await timeline.getByRole('button', { name: new RegExp(`#${snapshot.id}`) }).click();
    await Promise.all([
      timeline.getByRole('button', { name: 'Restore' }).click(),
      composer.getByRole('button', { name: 'Post' }).click(),
    ]);

    // Elements rolled back for everyone, live, without a reload or disconnect…
    await expect.poll(() => elements(owner.token, boardId).then((r) => r.length)).toBe(1);
    await expect.poll(() => elementCount(b.page)).toBe(1);
    await expect.poll(() => elementCount(a.page)).toBe(1);
    // …while the comment (not part of board snapshots) survived on both sides.
    const comments = await api<Array<{ content: string; x_position: number | null }>>(owner.token, `/boards/${boardId}/comments`);
    expect(comments.filter((c) => c.content === 'Comment during restore')).toHaveLength(1);
    await a.page.getByRole('tab', { name: /comments/i }).click();
    await expect(a.page.getByText('Comment during restore')).toBeVisible();
    await expect(b.page.getByText('Connection interrupted')).toHaveCount(0);

    await a.context.close();
    await b.context.close();
  });

  test('uploading an attachment while a collaborator moves elements loses neither change', async ({ browser }) => {
    const a = await openBoard(browser, owner, boardId);
    const b = await openBoard(browser, editor, boardId);
    const seed = `e2e_anchor_${boardId}`;

    // A drops a PDF onto empty canvas → document card with attachment
    const dataTransfer = await a.page.evaluateHandle(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(['%PDF-1.4 e2e'], 'spec.pdf', { type: 'application/pdf' }));
      return dt;
    });
    // Drop onto fabric's interaction layer, exactly where a real drop lands.
    const canvasHost = a.page.locator('canvas.upper-canvas');
    const box = (await canvasHost.boundingBox())!;
    const drop = canvasHost.dispatchEvent('drop', {
      dataTransfer,
      clientX: box.x + 120,
      clientY: box.y + 120,
    });

    // …while B moves the seed element repeatedly through the realtime path
    const moves = (async () => {
      for (const x of [500, 520, 540]) {
        await api(editor.token, `/boards/${boardId}/elements/${seed}`, {
          method: 'PATCH',
          body: JSON.stringify({ patch: { x } }),
        });
      }
    })();
    await Promise.all([drop, moves]);

    await expect
      .poll(async () => {
        const rows = await elements(owner.token, boardId);
        return {
          seedX: rows.find((r) => r.id === seed)?.element_data.x,
          docs: rows.filter((r) => r.element_data.kind === 'document' && r.element_data.attachment).length,
        };
      })
      .toEqual({ seedX: 540, docs: 1 });

    // The attachment is visible and previewable for the collaborator.
    await b.page.getByRole('button', { name: 'Preview spec.pdf' }).click();
    await expect(b.page.getByRole('dialog', { name: 'Preview spec.pdf' })).toBeVisible();

    await a.context.close();
    await b.context.close();
  });

  test('edits made offline are queued and synced after reconnecting', async ({ browser }) => {
    const a = await openBoard(browser, owner, boardId);
    const b = await openBoard(browser, editor, boardId);

    await a.context.setOffline(true);
    await expect(a.page.getByText(/Connection interrupted|Live session unavailable/)).toBeVisible({ timeout: 30_000 });

    await a.page.keyboard.press('r');
    await dragOnCanvas(a.page, [100, 100], [200, 180]);
    await expect(a.page.getByText(/change(s)? queued/).first()).toBeVisible();
    expect((await elements(owner.token, boardId)).length).toBe(1);

    await a.context.setOffline(false);
    await expect.poll(() => elements(owner.token, boardId).then((r) => r.length), { timeout: 30_000 }).toBe(2);
    await expect.poll(() => elementCount(b.page)).toBe(2);
    await expect(a.page.getByText('saved', { exact: true })).toBeVisible({ timeout: 15_000 });

    await a.context.close();
    await b.context.close();
  });
});
