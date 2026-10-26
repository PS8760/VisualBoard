import { test, expect, type Page } from '@playwright/test';

/** Suggestions panel: board-aware findings, Apply edits the board (one undo step), dismissals persist. */

const API = 'http://localhost:8000/api/v1';
let token = '';
let boardId = 0;
/** Element ids are unique server-wide, so suffix them per run. */
let sfx = '';
const ID = (base: string) => `${base}_${sfx}`;

type El = { id: string; kind: string; content?: string; startBinding?: { elementId: string } | null; endBinding?: { elementId: string } | null };

const call = async (method: string, url: string, body?: unknown) =>
  (await fetch(API + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })).json();

const elements = async (): Promise<El[]> =>
  ((await call('GET', `/boards/${boardId}/elements`)).data as Array<{ element_data: El }>).map((r) => r.element_data);

const rect = (id: string, content: string, x: number) => ({
  id, kind: 'rect', x, y: 0, width: 170, height: 60, rotation: 0, fill: '#fafaf8', stroke: '#c2c0b5', strokeWidth: 1.5, content,
});

async function openBoard(page: Page) {
  await page.addInitScript(() => localStorage.setItem('vb_onboarding_seen', 'true'));
  await page.goto('/login');
  await page.fill('#email', 'owner@example.com');
  await page.fill('#password', 'Password123!');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await page.goto(`/board/${boardId}`);
  await expect(page.getByText('saved', { exact: true })).toBeVisible();
  const open = page.getByRole('button', { name: 'Open panel' });
  if (await open.isVisible()) await open.click();
  await page.getByRole('tab', { name: /Suggestions/ }).click();
}

test.beforeEach(async () => {
  token = (await call('POST', '/auth/login', { email: 'owner@example.com', password: 'Password123!' })).data.token;
  boardId = (await call('POST', '/boards', { title: `Suggestions ${Date.now()}` })).data.id;
  sfx = `${boardId}`;
  for (const element of [
    rect(ID('web'), 'Web App', -400),
    rect(ID('pg'), 'Postgres', 200),
    {
      id: ID('link'), kind: 'arrow', x: 0, y: 0, width: 0, height: 0, rotation: 0, fill: 'transparent', stroke: '#a8a69c', strokeWidth: 1.5,
      content: '', points: [-230, 30, 200, 30], pointsAbsolute: true, startBinding: { elementId: ID('web') }, endBinding: { elementId: ID('pg') },
    },
  ]) {
    await call('POST', `/boards/${boardId}/elements`, { element });
  }
});

test('flags a client wired to the database and fixes it with one undoable step', async ({ page }) => {
  await openBoard(page);
  const card = page.locator('[data-testid=suggestion-card][data-kind=direct-db]');
  await expect(card).toContainText('“Web App” talks directly to “Postgres”');
  await expect(page.getByTestId('board-health')).toContainText('critical');
  await expect(page.getByRole('tab', { name: /Suggestions/ })).toContainText(/\d/);

  await card.getByRole('button', { name: 'Why this?' }).click();
  await expect(card).toContainText('read or change any row');

  await card.getByRole('button', { name: /Insert API layer/ }).click();
  await expect(card).toHaveCount(0);
  await expect.poll(async () => (await elements()).map((e) => e.id)).not.toContain(ID('link'));
  const after = await elements();
  const api = after.find((e) => e.kind === 'rect' && e.content === 'API')!;
  expect(api).toBeTruthy();
  const links = after.filter((e) => e.kind === 'arrow').map((e) => `${e.startBinding?.elementId}->${e.endBinding?.elementId}`);
  expect(links.sort()).toEqual([`${api.id}->${ID('pg')}`, `${ID('web')}->${api.id}`].sort());

  await page.getByRole('button', { name: 'Undo' }).first().click();
  await expect.poll(async () => (await elements()).map((e) => e.id).sort()).toEqual([ID('link'), ID('pg'), ID('web')].sort());
  await expect(page.locator('[data-testid=suggestion-card][data-kind=direct-db]')).toBeVisible();
});

test('dismissals stick per board across reloads and can be restored', async ({ page }) => {
  await openBoard(page);
  const card = page.locator('[data-testid=suggestion-card][data-kind=direct-db]');
  await card.getByRole('button', { name: /^Dismiss/ }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('saved', { exact: true })).toBeVisible();
  const open = page.getByRole('button', { name: 'Open panel' });
  if (await open.isVisible()) await open.click();
  await page.getByRole('tab', { name: /Suggestions/ }).click();
  await expect(page.locator('[data-testid=suggestion-card][data-kind=direct-db]')).toHaveCount(0);
  await page.getByText(/dismissed · restore/).click();
  await expect(page.locator('[data-testid=suggestion-card][data-kind=direct-db]')).toBeVisible();
});

test('a shape chip selects that shape on the canvas', async ({ page }) => {
  await openBoard(page);
  const card = page.locator('[data-testid=suggestion-card][data-kind=direct-db]');
  await card.getByRole('button', { name: 'Postgres', exact: true }).click();
  await expect(page.getByRole('toolbar', { name: 'Selection actions' })).toBeVisible();
});
