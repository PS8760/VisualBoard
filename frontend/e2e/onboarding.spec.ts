import { test, expect } from '@playwright/test';

test('onboarding tour spotlights the real tools and can be replayed', async ({ page }) => {
  const res = await fetch('http://localhost:8000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.com', password: 'Password123!' }),
  });
  const { token, user } = (await res.json()).data;
  await page.addInitScript(
    ({ token, session }) => {
      localStorage.setItem('vb_token', token);
      localStorage.setItem('vb_user', JSON.stringify(session));
    },
    { token, session: user },
  );

  await page.goto('/board/1');
  const tour = page.getByRole('dialog', { name: 'Welcome to VisualBoard' });
  await expect(tour).toBeVisible();
  await tour.getByRole('button', { name: /Show me around/ }).click();

  // Step 2 highlights the Select + Hand buttons and names their shortcuts.
  const step = page.getByRole('dialog', { name: 'Select & move around' });
  await expect(step.getByText(/Drag to pan/)).toBeVisible();
  const ring = await page.locator('.ring-accent').first().boundingBox();
  const select = await page.locator('[data-tour="tool-select"]').boundingBox();
  expect(ring && select && ring.x <= select.x && ring.y <= select.y && ring.x + ring.width >= select.x + select.width).toBeTruthy();

  // Board shortcuts are suppressed while touring (R would switch tools).
  await page.keyboard.press('r');
  await expect(page.locator('[data-tour="tool-select"]')).toHaveAttribute('aria-pressed', 'true');

  // Walk to the side-panel step: the panel opens for it and closes afterwards.
  for (let i = 0; i < 5; i++) await page.getByRole('dialog').getByRole('button', { name: /^Next/ }).click();
  await expect(page.getByRole('dialog', { name: 'Side panel' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Board panel' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /^Next/ }).click();
  await expect(page.getByRole('complementary', { name: 'Board panel' })).toHaveCount(0);

  for (let i = 0; i < 3; i++) await page.getByRole('dialog').getByRole('button', { name: /^Next/ }).click();
  await page.getByRole('button', { name: /Start creating/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('vb_onboarding_seen'))).toBe('true');

  // Not shown again on reload; replayable from Help.
  await page.reload();
  await page.waitForTimeout(1200);
  await expect(page.getByRole('dialog', { name: 'Welcome to VisualBoard' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show help' }).click();
  await page.getByRole('button', { name: /Replay tour/ }).click();
  await expect(page.getByRole('dialog', { name: 'Welcome to VisualBoard' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
