import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * The winning dish's name. It also appears on the leaderboard below, so it needs
 * disambiguating — it is the h1 since the restyle, which is the promise itself:
 * on this screen the dish that won is the headline, not a line under one.
 */
function winnerLine(page: Page) {
  return page.getByRole('heading', { level: 1 });
}

/**
 * Implements tests/e2e/participant-reveal.feature. The browser joins as Ana
 * (getting the first-party voter cookie on :5174); Bob casts a real vote and the
 * host closes the contest via API contexts. Tests then reveal (or not) and drive
 * Ana's reveal screen — which polls until the results are out.
 */
const API = 'http://localhost:3100';
const PARTICIPANT = 'http://localhost:5174';
const PASSWORD = 'Str0ng!Passw0rd';

function content(name: string) {
  return {
    name,
    attribution: 'per_person',
    antiBias: 'none',
    scoring: { categories: [{ id: 'taste', name: 'Taste' }], range: { type: 'fixed', min: 1, max: 5 }, uniquePerCategory: false },
    participants: [
      { id: 'ana', displayName: 'Ana' },
      { id: 'bob', displayName: 'Bob' },
      { id: 'carmen', displayName: 'Carmen' },
    ],
  };
}

async function apiCtx(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL: API });
}

/**
 * Publishes a contest, joins the browser as Ana, submits dishes, has Bob cast a
 * real vote (Ana's dish top), and closes the contest — but does NOT reveal.
 * Returns the contest id and the host context (to reveal when the test wants).
 */
async function seedVotedAndClosed(page: Page, email: string): Promise<{ contestId: string; host: APIRequestContext }> {
  const host = await apiCtx();
  await hostInvitedBy(email, PASSWORD);
  await host.post('/auth/login', { data: { email, password: PASSWORD } });
  const created = await host.post('/drafts', { data: content('Balcony Cook-off') });
  const published = await host.post(`/drafts/${(await created.json()).id}/publish`);
  const body = await published.json();
  const contestId = body.id as string;
  const joinCode = body.joinCode as string;

  // The browser joins as Ana — first-party voter cookie + remembered contest.
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Ana' }).click();
  await expect(page.getByRole('heading', { name: /your dish, ana/i })).toBeVisible();
  // Ana's own dish, submitted through the participant origin so her cookie rides along.
  await page.request.post(`${PARTICIPANT}/contests/${contestId}/dishes`, { data: { name: 'Ana paella' } });

  // Carmen claims and submits her dish (so it has a name on the leaderboard).
  const carmen = await apiCtx();
  await carmen.post(`/contests/${joinCode}/claim`, { data: { participantId: 'carmen' } });
  await carmen.post(`/contests/${contestId}/dishes`, { data: { name: 'Carmen gazpacho' } });

  // Bob claims, submits, and casts the only vote: Ana's dish 5, Carmen's 2 → Ana wins.
  const bob = await apiCtx();
  await bob.post(`/contests/${joinCode}/claim`, { data: { participantId: 'bob' } });
  await bob.post(`/contests/${contestId}/dishes`, { data: { name: 'Bob tortilla' } });
  await bob.post(`/contests/${contestId}/scores`, { data: { dishId: 'D-ana', categoryId: 'taste', value: 5 } });
  await bob.post(`/contests/${contestId}/scores`, { data: { dishId: 'D-carmen', categoryId: 'taste', value: 2 } });
  await bob.post(`/contests/${contestId}/send-vote`);

  await host.post(`/contests/${contestId}/close`);
  return { contestId, host };
}

test('results are held back until the host reveals them', async ({ page }) => {
  await seedVotedAndClosed(page, 'e2e-reveal-wait@sobremesa.es');

  await page.goto(`${PARTICIPANT}/reveal`);
  await expect(page.getByText(/almost there/i)).toBeVisible();
  await expect(page.getByText('Ana paella')).toHaveCount(0);
});

test('a participant sees the winners once the contest is revealed', async ({ page }) => {
  const { contestId, host } = await seedVotedAndClosed(page, 'e2e-reveal-winners@sobremesa.es');
  await host.post(`/contests/${contestId}/reveal`);

  await page.goto(`${PARTICIPANT}/reveal`);
  await expect(page.getByText('Winner')).toBeVisible();
  await expect(winnerLine(page)).toHaveText('Ana paella');
  // The leaderboard shows all three dishes, winner first.
  await expect(page.getByRole('region', { name: 'Leaderboard' }).getByRole('listitem')).toHaveCount(3);
});

test('the reveal appears when the host triggers it, without reloading', async ({ page }) => {
  const { contestId, host } = await seedVotedAndClosed(page, 'e2e-reveal-poll@sobremesa.es');

  await page.goto(`${PARTICIPANT}/reveal`);
  await expect(page.getByText(/almost there/i)).toBeVisible();

  // The host reveals while the participant waits — the poll picks it up.
  await host.post(`/contests/${contestId}/reveal`);
  await expect(winnerLine(page)).toHaveText('Ana paella', { timeout: 10_000 });
});

test('waiting says how the voting stands', async ({ page }) => {
  // Bob has sent; Ana (the browser) and Carmen have not. Carmen never scored.
  await seedVotedAndClosed(page, 'e2e-reveal-turnout@sobremesa.es');

  await page.goto(`${PARTICIPANT}/reveal`);
  await expect(page.getByText('1 of 3 votes in')).toBeVisible();

  const roster = page.getByRole('list', { name: 'Who has voted' });
  await expect(roster.getByRole('listitem')).toHaveCount(3);
  // In words, not by colour alone — this is read across a table in bad light.
  await expect(roster.getByRole('listitem').filter({ hasText: 'Bob' })).toContainText('in');
  await expect(roster.getByRole('listitem').filter({ hasText: 'Carmen' })).toContainText('still voting');

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('waiting still works when how the voting stands cannot be read', async ({ page }) => {
  await seedVotedAndClosed(page, 'e2e-reveal-turnout-down@sobremesa.es');

  // The one read this slice adds, failing — everything else untouched.
  await page.route('**/turnout', (route) => route.fulfill({ status: 500, body: '{}' }));

  await page.goto(`${PARTICIPANT}/reveal`);
  await expect(page.getByText(/almost there/i)).toBeVisible();
  await expect(page.getByText(/the moment the host reveals/i)).toBeVisible();
  // No roster, no error, and still not a dead end.
  await expect(page.getByRole('list', { name: 'Who has voted' })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Go to' })).toBeVisible();
});

test('the reveal names the cook as well as the dish', async ({ page }) => {
  const { contestId, host } = await seedVotedAndClosed(page, 'e2e-reveal-cook@sobremesa.es');
  await host.post(`/contests/${contestId}/reveal`);

  await page.goto(`${PARTICIPANT}/reveal`);

  // The dish is the headline — and it is still identified by the name it was
  // submitted under, with the cook named alongside rather than instead.
  await expect(winnerLine(page)).toHaveText('Ana paella');
  await expect(page.getByText('brought by Ana')).toBeVisible();
});

test('the reveal is accessible and honours reduced motion', async ({ page }) => {
  const { contestId, host } = await seedVotedAndClosed(page, 'e2e-reveal-a11y@sobremesa.es');
  await host.post(`/contests/${contestId}/reveal`);

  // With reduced motion the reveal animation is neutralised (final state at once) —
  // which is both the honoured preference and a stable frame for axe.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${PARTICIPANT}/reveal`);
  await expect(winnerLine(page)).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
});
