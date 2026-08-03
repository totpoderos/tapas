import { test } from '@playwright/test';
import { ADMINISTRATOR } from './support/administrator.js';

/** Scratch: screenshots the invite panel so it can be looked at. Not a specification. */
test('look at the invite panel', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(ADMINISTRATOR.email);
  await page.getByLabel('Password').fill(ADMINISTRATOR.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'People' }).waitFor();

  const card = page.locator('form').filter({ hasText: 'Send invitation' }).locator('..');
  await card.screenshot({ path: 'scratch-invite-panel.png' });
  await page.screenshot({ path: 'scratch-people-page.png' });
});
