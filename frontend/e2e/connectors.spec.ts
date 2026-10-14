import { test, expect, type Page, type Browser } from '@playwright/test';

/** Smart connector system: routing, binding, styling, waypoints, collaboration. */

const API = 'http://localhost:8000/api/v1';

type El = {
  id: string;
  kind: string;
  x: number;
  y: number;
  version: number;
  routing?: string;
  points?: number[];
  waypoints?: number[];
  endMarker?: string;
  label?: string;
  startBinding?: { elementId: string; anchor?: { type: string } } | null;
  endBinding?: { elementId: string; anchor?: { type: string } } | null;
};

async function login() {
  const res = await (await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.com', password: 'Password123!' }),
  })).json();
  return res.data as { token: string; user: unknown };
}

async function newBoard(token: string) {
  const board = (await (await fetch(`${API}/boards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: `Connectors ${Date.now()}` }),
  })).json()).data as { id: number };
  // An off-screen anchor keeps starter content from being seeded and frames the view at 100%.
  await fetch(`${API}/boards/${board.id}/elements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ element: { id: `anchor_${board.id}`, kind: 'text', x: 0, y: 0, width: 10, height: 10, rotation: 0, fill: 'transparent', stroke: 'transparent', strokeWidth: 0, content: '.' } }),
  });
  return board.id;
}

async function open(browser: Browser, session: { token: string; user: unknown }, boardId: number) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 860 } });
  const page = await context.newPage();
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('vb_token', token);
      localStorage.setItem('vb_user', JSON.stringify(user));
      localStorage.setItem('vb_onboarding_seen', 'true');
    },
    session,
  );
  await page.goto(`/board/${boardId}`);
  await expect(page.getByText('saved', { exact: true })).toBeVisible();
  return { context, page };
}

const all = async (token: string, boardId: number) =>
  ((await (await fetch(`${API}/boards/${boardId}/elements`, { headers: { Authorization: `Bearer ${token}` } })).json()).data as Array<{ element_data: El }>).map((r) => r.element_data);

async function at(page: Page, dx: number, dy: number) {
  const b = (await page.locator('canvas.upper-canvas').boundingBox())!;
  return { x: b.x + b.width / 2 + dx, y: b.y + b.height / 2 + dy };
}

async function drag(page: Page, from: [number, number], to: [number, number]) {
  const a = await at(page, ...from);
  const b = await at(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 8 });
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}

async function rectAt(page: Page, cx: number, cy: number, w: number, h: number) {
  await page.keyboard.press('r');
  await drag(page, [cx - w / 2, cy - h / 2], [cx + w / 2, cy + h / 2]);
  await page.keyboard.press('Escape');
}

test('connects two shapes with an orthogonal route that avoids an obstacle and stays attached', async ({ browser }) => {
  const session = await login();
  const boardId = await newBoard(session.token);
  const { context, page } = await open(browser, session, boardId);

  await rectAt(page, -340, 0, 160, 60);
  await rectAt(page, 0, 0, 80, 260); // obstacle between them
  await rectAt(page, 340, 0, 160, 60);
  await page.keyboard.press('a');
  await drag(page, [-340, 0], [340, 0]);

  await expect.poll(async () => (await all(session.token, boardId)).filter((e) => e.kind === 'arrow').length).toBe(1);
  const els = await all(session.token, boardId);
  const rects = els.filter((e) => e.kind === 'rect').sort((a, b) => a.x - b.x);
  const conn = els.find((e) => e.kind === 'arrow')!;
  expect(conn.routing).toBe('elbow');
  expect(conn.startBinding?.elementId).toBe(rects[0]!.id);
  expect(conn.endBinding?.elementId).toBe(rects[2]!.id);

  // Toolbar styling on the freshly drawn (selected) connector.
  await page.getByRole('radio', { name: 'Curved' }).click();
  await page.getByRole('button', { name: 'End marker' }).click();
  await page.getByRole('radio', { name: 'Diamond' }).click();
  await page.keyboard.press('Enter');
  await page.getByLabel('Shape label').fill('gRPC');
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => {
      const c = (await all(session.token, boardId)).find((e) => e.kind === 'arrow')!;
      return { routing: c.routing, endMarker: c.endMarker, label: c.label };
    })
    .toEqual({ routing: 'curved', endMarker: 'diamond', label: 'gRPC' });
  await context.close();
});

test('double-clicking a straight connector inserts a waypoint', async ({ browser }) => {
  const session = await login();
  const boardId = await newBoard(session.token);
  const { context, page } = await open(browser, session, boardId);
  await page.keyboard.press('a');
  await drag(page, [-200, 150], [200, 150]);
  await expect.poll(async () => (await all(session.token, boardId)).find((e) => e.kind === 'arrow')?.routing).toBe('straight');
  const mid = await at(page, 0, 150);
  await page.keyboard.press('v');
  await page.mouse.dblclick(mid.x, mid.y);
  await expect.poll(async () => (await all(session.token, boardId)).find((e) => e.kind === 'arrow')?.waypoints?.length).toBe(2);
  await context.close();
});

test('collaborators converge when a connected shape moves (no write ping-pong)', async ({ browser }) => {
  const session = await login();
  const boardId = await newBoard(session.token);
  const a = await open(browser, session, boardId);
  const b = await open(browser, session, boardId);

  await rectAt(a.page, -250, 0, 160, 60);
  await rectAt(a.page, 250, 0, 160, 60);
  await a.page.keyboard.press('a');
  await drag(a.page, [-250, 0], [250, 0]);
  await expect.poll(async () => (await all(session.token, boardId)).filter((e) => e.kind === 'arrow').length).toBe(1);

  // A drags the right box down; the connector's end must follow on the server.
  await a.page.keyboard.press('v');
  const before = (await all(session.token, boardId)).find((e) => e.kind === 'arrow')!;
  await drag(a.page, [250, 0], [250, 220]);
  await expect
    .poll(async () => (await all(session.token, boardId)).find((e) => e.kind === 'arrow')!.points![3]! - before.points![3]!)
    .toBeGreaterThan(150);

  // Both clients compute the same route: the connector settles (no ping-pong).
  await b.page.waitForTimeout(1500);
  const v1 = (await all(session.token, boardId)).find((e) => e.kind === 'arrow')!.version;
  await b.page.waitForTimeout(1500);
  const v2 = (await all(session.token, boardId)).find((e) => e.kind === 'arrow')!.version;
  expect(v2).toBe(v1);

  await a.context.close();
  await b.context.close();
});
