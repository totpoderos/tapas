import {
  test,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/participant-navigation.feature.
 *
 * These arrive the ways the other participant specs never do — by the browser's
 * back button, by a reload, and by the address alone. Every existing scenario
 * walks forward by following links, which is exactly why the scoring and results
 * screens shipped with no way off them at all.
 */
const API = 'http://localhost:3100';
const PARTICIPANT = 'http://localhost:5174';
const PASSWORD = 'Str0ng!Passw0rd';

function contestContent(name: string) {
  return {
    name,
    attribution: 'per_person',
    antiBias: 'none',
    closeRule: { when: 'host_trigger' },
    scoring: {
      categories: [{ id: 'c1', name: 'Taste' }],
      range: { type: 'fixed', min: 1, max: 5 },
      uniquePerCategory: false,
    },
    participants: [
      { id: 'a', displayName: 'Ana' },
      { id: 'b', displayName: 'Bruno' },
      { id: 'c', displayName: 'Carmen' },
    ],
  };
}

/** A live contest with Ana's and Carmen's dishes in, leaving Bruno for the browser. */
async function seedContest(email: string): Promise<{ joinCode: string; contestId: string }> {
  const host = await playwrightRequest.newContext({ baseURL: API });
  await hostInvitedBy(email, PASSWORD);
  await host.post('/auth/login', { data: { email, password: PASSWORD } });
  const created = await host.post('/drafts', { data: contestContent('Balcony Cook-off') });
  const published = await host.post(`/drafts/${(await created.json()).id}/publish`);
  const body = await published.json();
  const joinCode = body.joinCode as string;
  const contestId = body.id as string;
  for (const [pid, dish] of [
    ['a', 'Ana bravas'],
    ['c', 'Carmen gazpacho'],
  ] as const) {
    const cook: APIRequestContext = await playwrightRequest.newContext({ baseURL: API });
    await cook.post(`/contests/${joinCode}/claim`, { data: { participantId: pid } });
    await cook.post(`/contests/${contestId}/dishes`, { data: { name: dish } });
  }
  return { joinCode, contestId };
}

/** Joins as Bruno in the browser and enters his dish. */
async function joinAsBruno(page: Page, joinCode: string): Promise<void> {
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await page.getByLabel('Dish name').fill('Bruno tortilla');
  await page.getByRole('button', { name: /Submit dish|Update dish/ }).click();
  await expect(page.getByRole('navigation', { name: 'Go to' })).toBeVisible();
}

/** Scores every dish and sends, through the browser, as a participant would. */
async function scoreAndSend(page: Page): Promise<void> {
  const groups = page.getByRole('radiogroup');
  await groups.first().waitFor();
  const count = await groups.count();
  for (let i = 0; i < count; i++) await groups.nth(i).getByRole('radio', { name: '4' }).check();
  await page.getByRole('button', { name: 'Send my vote' }).click();
  await page.getByRole('button', { name: 'Yes, send my vote' }).click();
  await expect(page.getByText(/vote sent/i)).toBeVisible();
}

const waysOnward = (page: Page) => page.getByRole('navigation', { name: 'Go to' });

test('every step offers the others', async ({ page }) => {
  const { joinCode } = await seedContest('e2e-nav-steps@sobremesa.es');
  await joinAsBruno(page, joinCode);

  await page.goto(`${PARTICIPANT}/score`);
  const nav = waysOnward(page);
  await expect(nav.getByRole('link', { name: 'The dishes' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'The results' })).toBeVisible();
});

test('waiting for the results is not being stuck', async ({ page }) => {
  const { joinCode } = await seedContest('e2e-nav-waiting@sobremesa.es');
  await joinAsBruno(page, joinCode);

  await page.goto(`${PARTICIPANT}/reveal`);
  await expect(page.getByText(/almost there/i)).toBeVisible();

  const nav = waysOnward(page);
  await expect(nav.getByRole('link', { name: 'Your scores' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'The dishes' })).toBeVisible();
});

// The reported journey, end to end.
test('going back after voting shows the vote as sent', async ({ page }) => {
  const { joinCode } = await seedContest('e2e-nav-back@sobremesa.es');
  await joinAsBruno(page, joinCode);
  await page.goto(`${PARTICIPANT}/score`);
  await scoreAndSend(page);

  await page.getByRole('link', { name: 'See the results' }).click();
  await expect(page).toHaveURL(/\/reveal$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/score$/);

  // Going back is respected — not bounced onward to the results again.
  await expect(page.getByText(/vote sent/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send my vote' })).toHaveCount(0);
  await expect(waysOnward(page).getByRole('link', { name: 'The results' })).toBeVisible();
});

test('reloading does not lose the way onward', async ({ page }) => {
  const { joinCode } = await seedContest('e2e-nav-reload@sobremesa.es');
  await joinAsBruno(page, joinCode);
  await page.goto(`${PARTICIPANT}/score`);
  await scoreAndSend(page);

  await page.reload();

  // The state comes from the server, so a reload cannot lose it.
  await expect(page.getByText(/vote sent/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send my vote' })).toHaveCount(0);
  await expect(waysOnward(page).getByRole('link', { name: 'The results' })).toBeVisible();
});

test('arriving by the address alone is no different', async ({ page }) => {
  const { joinCode } = await seedContest('e2e-nav-direct@sobremesa.es');
  await joinAsBruno(page, joinCode);

  await page.goto(`${PARTICIPANT}/score`); // no link followed to get here
  const nav = waysOnward(page);
  await expect(nav.getByRole('link', { name: 'The dishes' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'The results' })).toBeVisible();
});
