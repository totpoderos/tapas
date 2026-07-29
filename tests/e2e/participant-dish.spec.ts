import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/participant-dish.feature against a real API + the
 * participant app. A live contest is seeded via a host context; the joiner is
 * driven through the participant app on :5174.
 */
const API = 'http://localhost:3100';
const PARTICIPANT = 'http://localhost:5174';
const PASSWORD = 'Str0ng!Passw0rd';

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

async function seedLiveContest(email: string): Promise<{ joinCode: string; contestId: string }> {
  const host = await playwrightRequest.newContext({ baseURL: API });
  await hostInvitedBy(email, PASSWORD);
  await host.post('/auth/login', { data: { email, password: PASSWORD } });
  const created = await host.post('/drafts', { data: completeContent('Balcony Cook-off') });
  const published = await host.post(`/drafts/${(await created.json()).id}/publish`);
  const body = await published.json();
  return { joinCode: body.joinCode as string, contestId: body.id as string };
}

/** Has another participant claim their place and submit a dish, over their own API session. */
async function otherCookSubmits(joinCode: string, contestId: string, participantId: string, dishName: string): Promise<void> {
  const cook: APIRequestContext = await playwrightRequest.newContext({ baseURL: API });
  await cook.post(`/contests/${joinCode}/claim`, { data: { participantId } });
  await cook.post(`/contests/${contestId}/dishes`, { data: { name: dishName } });
}

/** Joins the participant app as the named cook and lands on the your-dish screen. */
async function joinAs(page: Page, joinCode: string, name: string): Promise<void> {
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`your dish, ${name}`, 'i') })).toBeVisible();
}

test('a cook submits their dish and sees it as theirs', async ({ page }) => {
  const { joinCode } = await seedLiveContest('e2e-dish-submit@sobremesa.es');
  await joinAs(page, joinCode, 'Ana');

  await page.getByLabel('Dish name').fill('Patatas bravas');
  await page.getByRole('button', { name: 'Submit dish' }).click();

  const list = page.getByRole('list', { name: 'Dishes submitted' });
  const row = list.getByRole('listitem').filter({ hasText: 'Patatas bravas' });
  await expect(row).toContainText('Yours');
});

test('a cook revises their dish rather than adding a second', async ({ page }) => {
  const { joinCode } = await seedLiveContest('e2e-dish-revise@sobremesa.es');
  await joinAs(page, joinCode, 'Ana');

  await page.getByLabel('Dish name').fill('First idea');
  await page.getByRole('button', { name: 'Submit dish' }).click();
  await expect(page.getByRole('button', { name: 'Update dish' })).toBeVisible();

  await page.getByLabel('Dish name').fill('Second idea');
  await page.getByRole('button', { name: 'Update dish' }).click();

  const list = page.getByRole('list', { name: 'Dishes submitted' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list.getByText('Second idea')).toBeVisible();
  await expect(list.getByText('First idea')).toHaveCount(0);
});

test('a dish must have a name', async ({ page }) => {
  const { joinCode } = await seedLiveContest('e2e-dish-noname@sobremesa.es');
  await joinAs(page, joinCode, 'Ana');

  await page.getByRole('button', { name: 'Submit dish' }).click();

  await expect(page.getByRole('alert')).toContainText(/name/i);
  await expect(page.getByRole('list', { name: 'Dishes submitted' })).toHaveCount(0);
});

test('a participant sees the dishes submitted so far', async ({ page }) => {
  const { joinCode, contestId } = await seedLiveContest('e2e-dish-others@sobremesa.es');
  await otherCookSubmits(joinCode, contestId, 'c', 'Tortilla');

  await joinAs(page, joinCode, 'Ana');

  const list = page.getByRole('list', { name: 'Dishes submitted' });
  await expect(list.getByText('Tortilla')).toBeVisible();
});

test('submitting a dish is keyboard-operable and has no accessibility violations', async ({ page }) => {
  const { joinCode } = await seedLiveContest('e2e-dish-a11y@sobremesa.es');
  await joinAs(page, joinCode, 'Ana');

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);

  await page.getByLabel('Dish name').focus();
  await page.keyboard.type('Gazpacho');
  await page.getByRole('button', { name: 'Submit dish' }).click();

  await expect(page.getByRole('list', { name: 'Dishes submitted' }).getByText('Gazpacho')).toBeVisible();
});
