import { test, expect } from '@playwright/test';

test.describe('authentication flows', () => {
  test('rejects bad credentials with a visible error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveText(/Invalid email or password|INVALID_CREDENTIALS/i);
    expect(page.url()).toContain('/login');
  });

  test('logs in and lands on the dashboard with the seeded board', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('**/dashboard');
    await expect(page.getByText('Your projects')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Demo Board' })).toBeVisible();
  });

  test('guests land on a demo board', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Continue as guest' }).click();
    await page.waitForURL('**/board/demo-architecture');
  });
});