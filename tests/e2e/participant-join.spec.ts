import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

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
    format: 'solo_with_partners',
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
  await hostInvitedBy(email, PASSWORD);
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

test('an unrecognised join code is refused at the field', async ({ page }) => {
  await page.goto(`${PARTICIPANT}/`);
  await page.getByLabel('Join code').fill('ZZZZZZ');
  await page.getByRole('button', { name: 'Continue' }).click();

  const problem = page.getByRole('alert');
  await expect(problem).toContainText(/isn.t recognised/i);

  /*
   * Attached to the field, not floating above a title that still reads "Join
   * the contest". The field points at the message, which is what a screen
   * reader follows and what makes "attached" true rather than merely adjacent.
   */
  const field = page.getByLabel('Join code');
  await expect(field).toBeVisible();
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  const describedBy = await field.getAttribute('aria-describedby');
  expect(describedBy).toBeTruthy();
  await expect(page.locator(`#${describedBy}`)).toContainText(/isn.t recognised/i);
});

test('a place someone has already taken is shown, and cannot be chosen', async ({ page }) => {
  const { joinCode, host } = await seedLiveContest('e2e-join-shows-taken@sobremesa.es');

  // Carmen arrives first, through the API — she is not this browser.
  const carmen = await playwrightRequest.newContext({ baseURL: API });
  await carmen.post(`/contests/${joinCode}/claim`, { data: { participantId: 'c' } });

  await page.goto(`${PARTICIPANT}/j/${joinCode}`);

  /*
   * Carmen stays on the roster. Dropping her would leave a cook unable to tell
   * "somebody already took my name" from "this is the wrong contest" — and the
   * word has to be there as well as the dimming, because dimming is colour.
   */
  await expect(page.getByText('Carmen')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Carmen' })).toHaveCount(0);
  await expect(page.getByText(/^taken$/i).first()).toBeVisible();

  // The places still open are still open.
  await expect(page.getByRole('button', { name: 'Ana' })).toBeVisible();

  await carmen.dispose();
  await host.dispose();
});

test('a contest with every place taken explains itself', async ({ page }) => {
  const { joinCode, host } = await seedLiveContest('e2e-join-all-taken@sobremesa.es');

  const others = await playwrightRequest.newContext({ baseURL: API });
  for (const id of ['a', 'b', 'c', 'd']) {
    await others.post(`/contests/${joinCode}/claim`, { data: { participantId: id } });
  }

  await page.goto(`${PARTICIPANT}/j/${joinCode}`);

  await expect(page.getByRole('heading', { name: /every place is taken/i })).toBeVisible();
  // The roster is named, so a cook can see this is the contest they meant.
  for (const name of ['Ana', 'Bruno', 'Carmen', 'Diego']) {
    await expect(page.getByText(name)).toBeVisible();
  }
  // And there is a way out rather than a dead end.
  await expect(page.getByRole('button', { name: /try another code/i })).toBeVisible();

  await others.dispose();
  await host.dispose();
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
