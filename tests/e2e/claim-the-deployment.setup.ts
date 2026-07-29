import { test as setup, expect, request as playwrightRequest } from '@playwright/test';
import { clearMail, invitationLinkSentTo } from './support/mail.js';

/**
 * Claims the deployment, once, before every other project runs.
 *
 * This file is also the only place that can see an unclaimed deployment: the
 * state stops existing the moment it finishes. So the assertions about it live
 * here rather than in a specification that would have to depend on running
 * first.
 */
export const ADMINISTRATOR = {
  email: 'e2e-operator@sobremesa.es',
  password: 'Str0ng!Passw0rd',
};

setup('an unclaimed deployment offers itself, without taking sign-in away', async ({ page }) => {
  await page.goto('/sign-in');

  // Sign-in still works. An earlier version redirected here, which locked out
  // every host on a deployment that has accounts but no administrator.
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();

  await page.getByRole('link', { name: 'Set it up' }).click();
  await expect(page.getByRole('heading', { name: 'Set up this deployment' })).toBeVisible();
});

setup('the deployment is claimed', async ({ baseURL }) => {
  const api = await playwrightRequest.newContext({ baseURL });
  await clearMail();

  const claimed = await api.post('/setup/admin', { data: { email: ADMINISTRATOR.email } });
  expect(claimed.status()).toBe(201);
  expect((await claimed.json()).messageSent).toBe(true);

  const link = await invitationLinkSentTo(ADMINISTRATOR.email);
  const accepted = await api.post(`/invites/${link.slice(link.lastIndexOf('/') + 1)}/accept`, {
    data: { password: ADMINISTRATOR.password },
  });
  expect(accepted.status()).toBe(201);
  await api.dispose();
});
