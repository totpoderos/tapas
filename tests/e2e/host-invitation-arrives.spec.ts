import { test, expect, request as playwrightRequest } from '@playwright/test';
import { MAILPIT_API } from '../../playwright.config.js';
import { clearMail, invitationLinkSentTo } from './support/mail.js';

/**
 * Implements tests/e2e/host-invitation-arrives.feature against a real API, a
 * real SMTP catcher and the host app in a real browser.
 *
 * Everything about enrollment lives in this one file on purpose. The suite runs
 * a single in-memory API, and claiming a deployment happens once ever — so a
 * second spec file that also claimed would race this one for the 201, and which
 * won would depend on file ordering. Keeping the whole journey here makes the
 * order explicit: unclaimed first, then claimed, then invited.
 */
const ADMINISTRATOR = { email: 'e2e-operator@sobremesa.es', password: 'Str0ng!Passw0rd' };
const INVITED = 'e2e-invited@sobremesa.es';
const INVITED_PASSWORD = 'An0ther!Str0ngPass';

function tokenFrom(link: string): string {
  return link.slice(link.lastIndexOf('/') + 1);
}

/** Runs first, while nobody has claimed the deployment — the only moment this state exists. */
test('a deployment nobody has claimed offers itself', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Set up this deployment' })).toBeVisible();
  await expect(page).toHaveURL(/\/claim$/);
});

test.describe('once the deployment has an administrator', () => {
  test.beforeAll(async ({ baseURL }) => {
    const api = await playwrightRequest.newContext({ baseURL });
    await clearMail();
    const claimed = await api.post('/setup/admin', { data: { email: ADMINISTRATOR.email } });
    expect(claimed.status()).toBe(201);
    expect((await claimed.json()).messageSent).toBe(true);

    const link = await invitationLinkSentTo(ADMINISTRATOR.email);
    const accepted = await api.post(`/invites/${tokenFrom(link)}/accept`, {
      data: { password: ADMINISTRATOR.password },
    });
    expect(accepted.status()).toBe(201);
    await api.dispose();
  });

  async function signedInAdministrator(baseURL: string) {
    const api = await playwrightRequest.newContext({ baseURL });
    await api.post('/auth/login', { data: ADMINISTRATOR });
    return api;
  }

  test('an invited person opens their link and becomes a host', async ({ page, baseURL }) => {
    const api = await signedInAdministrator(baseURL!);
    await clearMail();

    const invited = await api.post('/admin/invites', { data: { email: INVITED } });
    expect(invited.status()).toBe(201);
    const body = await invited.json();
    expect(body.messageSent).toBe(true);
    // Handed off, so the administrator is offered no link — the message is the only copy.
    expect(body.link).toBeUndefined();
    await api.dispose();

    const link = await invitationLinkSentTo(INVITED);

    // The whole point of this slice: the link goes somewhere, in a browser.
    await page.goto(link);
    await expect(page.getByText(INVITED)).toBeVisible();
    await page.getByLabel('Password').fill(INVITED_PASSWORD);
    await page.getByRole('button', { name: 'Set password' }).click();

    await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();
  });

  test('a link that has already been used says so', async ({ page, baseURL }) => {
    const api = await signedInAdministrator(baseURL!);
    await clearMail();
    await api.post('/admin/invites', { data: { email: 'e2e-spent@sobremesa.es' } });
    const link = await invitationLinkSentTo('e2e-spent@sobremesa.es');
    // Spend it over HTTP, then arrive at it in the browser as a second person would.
    await api.post(`/invites/${tokenFrom(link)}/accept`, { data: { password: INVITED_PASSWORD } });
    await api.dispose();

    await page.goto(link);

    await expect(page.getByRole('heading', { name: 'This link cannot be used' })).toBeVisible();
    await expect(page.getByLabel('Password')).toHaveCount(0);
    // The refusal names nobody, whatever the reason behind it was.
    await expect(page.locator('main')).not.toContainText('@');
  });

  test('the message reaches the invited address and nobody else', async ({ baseURL }) => {
    const api = await signedInAdministrator(baseURL!);
    await clearMail();
    await api.post('/admin/invites', { data: { email: 'e2e-solo@sobremesa.es' } });
    await invitationLinkSentTo('e2e-solo@sobremesa.es');
    await api.dispose();

    const mail = await playwrightRequest.newContext({ baseURL: MAILPIT_API });
    const messages = (await (await mail.get('/api/v1/messages')).json()).messages ?? [];
    await mail.dispose();

    expect(messages).toHaveLength(1);
    expect(messages[0].To.map((recipient: { Address: string }) => recipient.Address)).toEqual([
      'e2e-solo@sobremesa.es',
    ]);
  });
});
