import { test, expect, request as playwrightRequest } from '@playwright/test';
import { MAILPIT_API } from '../../playwright.config.js';
import { clearMail, invitationLinkSentTo } from './support/mail.js';
import { ADMINISTRATOR } from './claim-the-deployment.setup.js';

/**
 * Implements tests/e2e/host-invitation-arrives.feature against a real API, a
 * real SMTP catcher and the host app in a real browser.
 *
 * The administrator this file needs is created by the setup project, which
 * claims the deployment once before anything runs — so this file is about
 * enrollment rather than about setting the world up, and any other file may
 * assume an administrator too.
 */
const INVITED = 'e2e-invited@sobremesa.es';
const INVITED_PASSWORD = 'An0ther!Str0ngPass';

function tokenFrom(link: string): string {
  return link.slice(link.lastIndexOf('/') + 1);
}

test.describe('once the deployment has an administrator', () => {
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
