import { test, expect, type APIRequestContext } from '@playwright/test';

async function loginAs(request: APIRequestContext) {
  const res = await request.post('http://localhost:8000/api/v1/auth/login', {
    data: { email: 'editor@example.com', password: 'Password123!' },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data;
}

test.describe('dashboard', () => {
  test('creates a project, opens it, then deletes it from settings', async ({ page, request }) => {
    const { token, user } = await loginAs(request);
    const title = `E2E Project ${Date.now()}`;

    await page.addInitScript(
      ({ token, session }) => {
        localStorage.setItem('vb_token', token);
        localStorage.setItem('vb_user', JSON.stringify(session));
        localStorage.setItem('vb_onboarding_seen', 'true');
      },
      { token, session: user },
    );

    await page.goto('/dashboard');
    await expect(page.getByText('Your projects')).toBeVisible();

    await page.getByLabel('Project name').fill(title);
    await page.getByPlaceholder('Short description (optional)').fill('Created by the dashboard E2E test');
    await page.getByRole('button', { name: 'Create' }).click();

    await page.waitForURL(/\/board\/\d+$/);
    await expect(page.getByText(title)).toBeVisible();

    // cleanup: open settings and delete the board
    page.on('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Board settings' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete board' }).click();
    await page.waitForURL('**/dashboard');
    await expect(page.getByText(title)).not.toBeVisible();
  });

  test('filters projects by name', async ({ page, request }) => {
    const { token, user } = await loginAs(request);
    const title = `E2E Filter Board ${Date.now()}`;
    const created = await fetch('http://localhost:8000/api/v1/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title }),
    });
    expect(created.ok).toBeTruthy();

    await page.addInitScript(
      ({ token, session }) => {
        localStorage.setItem('vb_token', token);
        localStorage.setItem('vb_user', JSON.stringify(session));
        localStorage.setItem('vb_onboarding_seen', 'true');
      },
      { token, session: user },
    );

    await page.goto('/dashboard');
    await page.getByLabel('Filter projects').fill(title);
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText('Demo Board for VisualBoard')).not.toBeVisible();

    await page.getByLabel('Filter projects').fill('zzz-nothing-matches');
    await expect(page.getByText(/No projects match the filter/i)).toBeVisible();
  });
});