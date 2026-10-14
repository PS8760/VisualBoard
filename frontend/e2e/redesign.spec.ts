import { test, expect, type Page } from '@playwright/test';

/** Interaction-model tests for the spatial UI: connectors, labels, quick actions, ink, chrome. */

const API = 'http://localhost:8000/api/v1';

type El = {
  id: string;
  kind: string;
  x: number;
  y: number;
  content?: string;
  fill?: string;
  locked?: boolean;
  zIndex?: number;
  points?: number[];
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
};

let token = '';
let user: unknown;

async function freshBoard(page: Page) {
  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.com', password: 'Password123!' }),
  })).json();
  token = login.data.token;
  user = login.data.user;
  // An existing anchor element keeps the starter content from being seeded.
  const board = (await (await fetch(`${API}/boards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: `Spatial ${Date.now()}` }),
  })).json()).data as { id: number };
  await fetch(`${API}/boards/${board.id}/elements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ element: { id: `anchor_${board.id}`, kind: 'text', x: -2000, y: -2000, width: 10, height: 10, rotation: 0, fill: 'transparent', stroke: 'transparent', strokeWidth: 0, content: '.' } }),
  });
  await page.addInitScript(
    ({ token, session }) => {
      localStorage.setItem('vb_token', token);
      localStorage.setItem('vb_user', JSON.stringify(session));
      localStorage.setItem('vb_onboarding_seen', 'true');
    },
    { token, session: user },
  );
  await page.goto(`/board/${board.id}`);
  await expect(page.getByText('saved', { exact: true })).toBeVisible();
  return board.id;
}

const elements = async (boardId: number) =>
  ((await (await fetch(`${API}/boards/${boardId}/elements`, { headers: { Authorization: `Bearer ${token}` } })).json()).data as Array<{ element_data: El }>).map((r) => r.element_data);

async function screen(page: Page, wx: number, wy: number) {
  const box = (await page.locator('canvas.upper-canvas').boundingBox())!;
  return { x: box.x + box.width / 2 + wx, y: box.y + box.height / 2 + wy };
}

async function drag(page: Page, from: [number, number], to: [number, number]) {
  const a = await screen(page, ...from);
  const b = await screen(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 });
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}

test('connectors attach to shapes and follow them when moved', async ({ page }) => {
  const boardId = await freshBoard(page);
  await page.keyboard.press('r');
  await drag(page, [-300, -40], [-160, 40]);
  await page.keyboard.press('r');
  await drag(page, [160, -40], [300, 40]);
  await page.keyboard.press('a');
  await drag(page, [-230, 0], [230, 0]);

  await expect.poll(async () => (await elements(boardId)).filter((e) => e.kind === 'arrow').length).toBe(1);
  const before = await elements(boardId);
  const rects = before.filter((e) => e.kind === 'rect').sort((a, b) => a.x - b.x);
  const arrow = before.find((e) => e.kind === 'arrow')!;
  expect(arrow.startBinding?.elementId).toBe(rects[0]!.id);
  expect(arrow.endBinding?.elementId).toBe(rects[1]!.id);

  // Drag the right box down: the connector's end must follow it.
  const endYBefore = arrow.points![3]!;
  await page.keyboard.press('v');
  await drag(page, [230, 0], [230, 200]);
  await expect
    .poll(async () => {
      const a = (await elements(boardId)).find((e) => e.kind === 'arrow')!;
      return a.points![3]! - endYBefore > 150;
    })
    .toBe(true);
});

test('shape labels, quick actions and locking persist', async ({ page }) => {
  const boardId = await freshBoard(page);
  await page.keyboard.press('r');
  await drag(page, [-80, -40], [80, 40]);
  await page.keyboard.press('Enter');
  await page.getByLabel('Shape label').fill('Payments service');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await elements(boardId)).find((e) => e.kind === 'rect')?.content).toBe('Payments service');

  // Selection toolbar: color + lock + bring to front.
  const p = await screen(page, 0, 0);
  await page.mouse.click(p.x, p.y);
  const bar = page.getByTestId('selection-toolbar');
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: 'Color' }).click();
  await page.getByRole('button', { name: 'Fill Mint' }).click();
  await bar.getByRole('button', { name: 'Bring to front' }).click();
  await bar.getByRole('button', { name: 'Lock' }).click();
  await expect
    .poll(async () => {
      const r = (await elements(boardId)).find((e) => e.kind === 'rect')!;
      return { fill: r.fill, locked: r.locked, front: (r.zIndex ?? 0) >= 1 };
    })
    .toEqual({ fill: '#dcf5e3', locked: true, front: true });

  // Locked: dragging does not move it.
  const x0 = (await elements(boardId)).find((e) => e.kind === 'rect')!.x;
  await drag(page, [0, 0], [150, 150]);
  await page.waitForTimeout(400);
  expect((await elements(boardId)).find((e) => e.kind === 'rect')!.x).toBe(x0);
});

test('holding still at the end of a pen stroke snaps it to a shape', async ({ page }) => {
  const boardId = await freshBoard(page);
  await page.keyboard.press('p');
  const c = await screen(page, 0, 0);
  const r = 80;
  await page.mouse.move(c.x + r, c.y);
  await page.mouse.down();
  for (let i = 1; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    await page.mouse.move(c.x + Math.cos(a) * r * (i % 3 ? 1.04 : 0.97), c.y + Math.sin(a) * r);
  }
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(page.getByText('Snapped to circle')).toBeVisible();
  await expect.poll(async () => (await elements(boardId)).some((e) => e.kind === 'circle')).toBe(true);
  expect((await elements(boardId)).some((e) => e.kind === 'pen')).toBe(false);
});

test('zen mode hides the chrome and the minimap toggles', async ({ page }) => {
  await freshBoard(page);
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Minimap/ })).toBeVisible();
  await page.keyboard.press('m');
  await expect(page.getByRole('img', { name: /Minimap/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Zen mode' }).click();
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
});

test('arrange lays out by flow, keeps connectors attached, and is one undo step', async ({ page }) => {
  const boardId = await freshBoard(page);
  const mk = (element: Record<string, unknown>) =>
    fetch(`${API}/boards/${boardId}/elements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ element }),
    });
  const rect = (id: string, x: number, y: number, content: string) => ({
    id, kind: 'rect', x, y, width: 170, height: 60, rotation: 0, fill: '#fafaf8', stroke: '#c2c0b5', strokeWidth: 1.5, content,
  });
  // The reported layout: boxes scattered, arrows unbound (seed-style), a sticky note.
  await mk(rect(`c_${boardId}`, -300, 200, 'Client'));
  await mk(rect(`a_${boardId}`, 100, -150, 'API'));
  await mk(rect(`d_${boardId}`, -100, 400, 'Database'));
  await mk({ id: `n_${boardId}`, kind: 'sticky', x: 300, y: 300, width: 200, height: 110, rotation: 0, fill: '#fdeeb0', stroke: '#e6cf74', strokeWidth: 1, content: 'Note' });
  await mk({ id: `e1_${boardId}`, kind: 'arrow', x: 0, y: 0, width: 0, height: 0, rotation: 0, fill: 'transparent', stroke: '#a8a69c', strokeWidth: 1.5, content: '', points: [-130, 230, 100, -120] });
  await mk({ id: `e2_${boardId}`, kind: 'arrow', x: 0, y: 0, width: 0, height: 0, rotation: 0, fill: 'transparent', stroke: '#a8a69c', strokeWidth: 1.5, content: '', points: [180, -90, -20, 400] });
  await page.reload();
  await expect(page.getByText('saved', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Arrange elements' }).click();
  await expect(page.getByText('Board arranged')).toBeVisible();

  const byId = async () => new Map((await elements(boardId)).map((e) => [e.id, e] as const));
  await expect
    .poll(async () => {
      const m = await byId();
      const [c, a, d] = [`c_${boardId}`, `a_${boardId}`, `d_${boardId}`].map((id) => m.get(id)!);
      const e1 = m.get(`e1_${boardId}`)!;
      return {
        order: c.x < a.x && a.x < d.x,
        aligned: c.y === a.y && a.y === d.y,
        bound: e1.startBinding?.elementId === c.id && e1.endBinding?.elementId === a.id,
        noteBeside: m.get(`n_${boardId}`)!.x > d.x + 170,
      };
    })
    .toEqual({ order: true, aligned: true, bound: true, noteBeside: true });

  // A single undo restores the previous layout.
  await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
  await expect.poll(async () => (await byId()).get(`c_${boardId}`)!.x).toBe(-300);
});

test('tooltips never cover toolbar menus and close on click', async ({ page }) => {
  await freshBoard(page);
  /** Every option's center must hit the option itself — nothing drawn on top. */
  const assertUncovered = async (locator: ReturnType<Page['locator']>) => {
    const n = await locator.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const el = locator.nth(i);
      const covered = await el.evaluate((node) => {
        const r = node.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !(hit && (node === hit || node.contains(hit)));
      });
      expect(covered, `option ${i} is covered`).toBe(false);
    }
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  };

  // Hover shows a tooltip; clicking the button dismisses it.
  const select = page.getByRole('button', { name: 'Select', exact: true });
  await select.hover();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await select.click();
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  // Shapes flyout.
  await page.getByRole('button', { name: 'Shapes' }).click();
  await assertUncovered(page.getByRole('menu', { name: 'Shapes' }).getByRole('menuitemradio'));
  await page.getByRole('menuitemradio', { name: 'Circle' }).click();
  await page.keyboard.press('v');

  // Selection toolbar colour popover.
  await page.keyboard.press('r');
  const c = await screen(page, 0, 0);
  await page.mouse.move(c.x - 80, c.y - 40);
  await page.mouse.down();
  await page.mouse.move(c.x + 80, c.y + 40, { steps: 6 });
  await page.mouse.up();
  await page.getByTestId('selection-toolbar').getByRole('button', { name: 'Color' }).click();
  await assertUncovered(page.getByRole('button', { name: /^Fill / }));
  await page.getByRole('button', { name: 'Fill Sky' }).click();

  // Pen options above the dock: moving from a dock button onto the bar closes its tooltip.
  await page.keyboard.press('p');
  await page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Pen', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.getByRole('radio', { name: 'Vermilion' }).hover();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await assertUncovered(page.getByRole('radiogroup', { name: 'Color' }).getByRole('radio'));

  // Zoom presets menu.
  await page.getByRole('button', { name: /zoom presets/ }).click();
  await assertUncovered(page.getByRole('menuitem'));
});
