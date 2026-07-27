import { test, expect } from '@playwright/test';

/**
 * Implements tests/e2e/theme-toggle.feature against the host app in a real
 * browser. The control lives on every screen; the sign-in screen needs no
 * account, so we exercise it there. We pin the OS preference to light so the
 * starting point is deterministic, then drive the toggle and a reload.
 */
test.use({ colorScheme: 'light' });

test('switches the whole app to dark and back, and offers the reverse each time', async ({ page }) => {
  await page.goto('/sign-in');
  const html = page.locator('html');

  // Following the (light) OS preference to begin with — no forced theme yet.
  await expect(html).not.toHaveAttribute('data-theme', 'dark');
  const toggle = page.getByRole('button', { name: 'Switch to dark theme' });
  await expect(toggle).toBeVisible();

  await toggle.click();
  await expect(html).toHaveAttribute('data-theme', 'dark');

  // The control now offers the way back.
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
});

test('remembers the chosen theme across a reload', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
