import { test, expect, request as playwrightRequest } from '@playwright/test';
import { MAILPIT_API } from '../../playwright.config.js';
import { clearMail, invitationLinkSentTo } from './support/mail.js';

/**
 * Implements tests/e2e/host-invitation-arrives.feature against a real API and a
 * real SMTP catcher, finishing in a real browser.
 *
 * Every smoke test since the invitation was built has had to seed a token hash,
 * because the link existed only inside the API process. It does not any more:
 * this reads it out of the message that was actually sent.
 *
 * The link is followed over HTTP rather than in the browser — the page it points
 * at is the next slice's. What this proves is the seam: real SMTP, a real
 * message, and a link from that message that genuinely works. The final sign-in
 * runs in the browser, so the account it created is shown to be a real one.
 */
const ADMINISTRATOR = { email: 'e2e-operator@sobremesa.es', password: 'Str0ng!Passw0rd' };
const INVITED = 'e2e-invited@sobremesa.es';
const INVITED_PASSWORD = 'An0ther!Str0ngPass';

function tokenFrom(link: string): string {
  return link.slice(link.lastIndexOf('/') + 1);
}

/**
 * Claims the deployment once for the whole file. The API runs on one in-memory
 * database for the suite, and a deployment can only be claimed once — so this
 * is `beforeAll`, and it is itself the bootstrap path running over real SMTP.
 */
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

test('an invited person receives their link and becomes a host', async ({ page, baseURL }) => {
  const api = await signedInAdministrator(baseURL!);
  await clearMail();

  const invited = await api.post('/admin/invites', { data: { email: INVITED } });
  expect(invited.status()).toBe(201);
  expect((await invited.json()).messageSent).toBe(true);
  // Handed off, so the administrator is offered no link — the message is the only copy.
  expect((await invited.json()).link).toBeUndefined();

  const link = await invitationLinkSentTo(INVITED);
  const accepted = await api.post(`/invites/${tokenFrom(link)}/accept`, {
    data: { password: INVITED_PASSWORD },
  });
  expect(accepted.status()).toBe(201);
  await api.dispose();

  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(INVITED);
  await page.getByLabel('Password').fill(INVITED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();
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
