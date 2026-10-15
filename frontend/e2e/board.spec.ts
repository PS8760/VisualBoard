import { test, expect, type APIRequestContext } from '@playwright/test';

async function loginAs(request: APIRequestContext) {
  const res = await request.post('http://localhost:8000/api/v1/auth/login', {
    data: { email: 'owner@example.com', password: 'Password123!' },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data;
}

function createComment(text: string, boardId: string, token: string) {
  return fetch(`http://localhost:8000/api/v1/boards/${boardId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content: text, x_position: 10, y_position: 10 }),
  });
}

test.describe('board page', () => {
  test('renders the live board with comments from the API', async ({ page, request }) => {
    const { token, user } = await loginAs(request);
    await page.addInitScript(
      ({ token, session }) => {
        localStorage.setItem('vb_token', token);
        localStorage.setItem('vb_user', JSON.stringify(session));
        localStorage.setItem('vb_onboarding_seen', 'true');
      },
      { token, session: user },
    );

    await page.goto('/board/1');
    await expect(page.getByText('Demo Board')).toBeVisible();

    await page.getByRole('button', { name: 'Open panel' }).click();
    await page.getByRole('tab', { name: /comments/i }).click();
    await expect(page.getByRole('textbox', { name: 'New comment' })).toBeVisible();
    await expect(page.getByText(/Nice, a template! Clone it and make it yours/i)).toBeVisible();
  });

  test('posts a comment that survives a reload (persisted via API)', async ({ page, request }) => {
    const { token, user } = await loginAs(request);
    const text = `e2e comment ${Date.now()}`;
    await page.addInitScript(
      ({ token, session }) => {
        localStorage.setItem('vb_token', token);
        localStorage.setItem('vb_user', JSON.stringify(session));
        localStorage.setItem('vb_onboarding_seen', 'true');
      },
      { token, session: user },
    );

    await page.goto('/board/1');
    await page.getByRole('button', { name: 'Open panel' }).click();
    await page.getByRole('tab', { name: /comments/i }).click();
    await page.getByRole('textbox', { name: 'New comment' }).fill(text);
    await page.getByRole('button', { name: 'Post' }).click();
    await expect(page.getByText(text)).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Open panel' }).click();
    await page.getByRole('tab', { name: /comments/i }).click();
    await expect(page.getByText(text)).toBeVisible();
  });

  test('creating a board via the API is listed and opens', async ({ page, request }) => {
    const { token, user } = await loginAs(request);
    const title = `E2E Board ${Date.now()}`;
    const created = await fetch('http://localhost:8000/api/v1/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title }),
    });
    expect(created.ok).toBeTruthy();
    const { data: board } = await created.json();

    await page.addInitScript(
      ({ token, session }) => {
        localStorage.setItem('vb_token', token);
        localStorage.setItem('vb_user', JSON.stringify(session));
        localStorage.setItem('vb_onboarding_seen', 'true');
      },
      { token, session: user },
    );

    await createComment('empty board comment', board.id, token);

    await page.goto(`/board/${board.id}`);
    await expect(page.getByText(title)).toBeVisible();
    await page.getByRole('button', { name: 'Open panel' }).click();
    await page.getByRole('tab', { name: /comments/i }).click();
    await expect(page.getByText('empty board comment')).toBeVisible();
  });
});