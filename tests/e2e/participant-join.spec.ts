import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Implements tests/e2e/participant-join.feature against a real API + the
 * participant app. A host contest is seeded through a separate API context
 * (host auth), then the participant app on :5174 is driven as a joiner would.
 */
const API = 'http://localhost:3100';
const PARTICIPANT = 'http://localhost:5174';
const PASSWORD = 'Str0ng!Passw0rd';

/** A complete, publishable draft with four named people in two couples. */
function completeContent(name: string) {
  return {
    name,
    attribution: 'per_person',
    antiBias: 'couples',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: true },
    participants: [
      { id: 'a', displayName: 'Ana', partnerId: 'b' },
      { id: 'b', displayName: 'Bruno', partnerId: 'a' },
      { id: 'c', displayName: 'Carmen', partnerId: 'd' },
      { id: 'd', displayName: 'Diego', partnerId: 'c' },
    ],
  };
}

/** Seeds a live contest via a fresh host and returns its join code (+ an API context to act as others). */
async function seedLiveContest(email: string): Promise<{ joinCode: string; host: APIRequestContext }> {
  const host = await playwrightRequest.newContext({ baseURL: API });
  await host.post('/auth/register', { data: { email, password: PASSWORD } });
  await host.post('/auth/login', { data: { email, password: PASSWORD } });
  const created = await host.post('/drafts', { data: completeContent('Balcony Cook-off') });
  const published = await host.post(`/drafts/${(await created.json()).id}/publish`);
  return { joinCode: (await published.json()).joinCode as string, host };
}

test('a participant joins by choosing their place', async ({ page }) => {
  const { joinCode } = await seedLiveContest('e2e-join-host@sobremesa.es');

  await page.goto(`${PARTICIPANT}/`);
  await page.getByLabel('Join code').fill(joinCode);
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('button', { name: 'Ana' }).click();
  await expect(page.getByRole('heading', { name: /your dish, ana/i })).toBeVisible();
});

test('an unrecognised join code is refused', async ({ page }) => {
  await page.goto(`${PARTICIPANT}/`);
  await page.getByLabel('Join code').fill('ZZZZZZ');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('alert')).toContainText(/isn.t recognised/i);
  await expect(page.getByLabel('Join code')).toBeVisible();
});

test('a place taken since the list loaded cannot be claimed', async ({ page }) => {
  const { joinCode, host } = await seedLiveContest('e2e-join-taken@sobremesa.es');

  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await expect(page.getByRole('button', { name: 'Ana' })).toBeVisible();

  // Someone else claims Ana's place before this joiner chooses it.
  await host.post(`/contests/${joinCode}/claim`, { data: { participantId: 'a' } });

  await page.getByRole('button', { name: 'Ana' }).click();
  await expect(page.getByRole('alert')).toContainText(/just taken/i);
  await expect(page.getByRole('button', { name: 'Ana' })).toHaveCount(0);
});

test('a returning participant is remembered on their device', async ({ page }) => {
  const { joinCode } = await seedLiveContest('e2e-join-return@sobremesa.es');

  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await expect(page.getByRole('heading', { name: /your dish, bruno/i })).toBeVisible();

  await page.goto(`${PARTICIPANT}/`); // reopen, no code
  await expect(page.getByRole('heading', { name: /your dish, bruno/i })).toBeVisible();
});

test('joining is keyboard-operable and has no accessibility violations', async ({ page }) => {
  const { joinCode } = await seedLiveContest('e2e-join-a11y@sobremesa.es');

  await page.goto(`${PARTICIPANT}/`);
  await expect(page.getByLabel('Join code')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);

  await page.getByLabel('Join code').focus();
  await page.keyboard.type(joinCode);
  await page.keyboard.press('Enter');

  await page.getByRole('button', { name: 'Carmen' }).click();
  await expect(page.getByRole('heading', { name: /your dish, carmen/i })).toBeVisible();
});
