import { test, expect, request as playwrightRequest } from '@playwright/test';
import { ADMINISTRATOR } from './claim-the-deployment.setup.js';
import { clearMail, invitationLinkSentTo } from './support/mail.js';

/**
 * Implements tests/e2e/host-people-panel.feature.
 *
 * This file exists in its own right because the setup project claims the
 * deployment — before it, anything needing an administrator had to live in the
 * one file that did the claiming.
 */
const HOST = { email: 'e2e-panel-host@sobremesa.es', password: 'Str0ng!Passw0rd' };

async function signIn(page: import('@playwright/test').Page, who: typeof ADMINISTRATOR) {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();
}

test('an administrator invites somebody and sees them appear', async ({ page }) => {
  await clearMail();
  await signIn(page, ADMINISTRATOR);

  await page.getByRole('link', { name: 'People' }).click();
  await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();

  await page.getByLabel('Email').fill('e2e-panel-invited@sobremesa.es');
  await page.getByRole('button', { name: 'Send invitation' }).click();

  const row = page.getByRole('row').filter({ hasText: 'e2e-panel-invited@sobremesa.es' });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Invited');
});

test('an administrator resends and revokes from the row', async ({ page }) => {
  await clearMail();
  await signIn(page, ADMINISTRATOR);
  await page.goto('/people');

  await page.getByLabel('Email').fill('e2e-panel-churn@sobremesa.es');
  await page.getByRole('button', { name: 'Send invitation' }).click();
  const row = page.getByRole('row').filter({ hasText: 'e2e-panel-churn@sobremesa.es' });
  await expect(row).toContainText('Invited');

  await row.getByRole('button', { name: 'Resend' }).click();
  // Still one row: the superseded invitation is no longer the newest, so it
  // stops standing for this person rather than joining them.
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Invited');
  await invitationLinkSentTo('e2e-panel-churn@sobremesa.es');

  await row.getByRole('button', { name: 'Revoke' }).click();
  await expect(row).toContainText('Invitation revoked');
});

test('a host is told the screen is not for them', async ({ page, baseURL }) => {
  // Registered directly: open registration is still there until the last slice.
  const api = await playwrightRequest.newContext({ baseURL });
  await api.post('/auth/register', { data: HOST });
  await api.dispose();

  await signIn(page, HOST);
  await expect(page.getByRole('link', { name: 'People' })).toHaveCount(0);

  await page.goto('/people');
  await expect(page.getByRole('heading', { name: 'This screen is not for you' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText(ADMINISTRATOR.email);
});
