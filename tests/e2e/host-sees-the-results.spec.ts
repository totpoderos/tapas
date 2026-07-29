import {
  test,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/host-sees-the-results.feature. The host reaches their own
 * results screen on :5173 and sees the very same reveal a participant sees on
 * :5174 — one shared `RevealView` behind two different reads, which is the point
 * of the change: the two screens cannot drift apart.
 */
const API = 'http://localhost:3100';
const HOST_WEB = 'http://localhost:5173';
const PARTICIPANT = 'http://localhost:5174';
const PASSWORD = 'Str0ng!Passw0rd';

/**
 * The winning dish's name, which also appears on the leaderboard below — anchored
 * to the heading it sits under rather than to a class name, since the reveal view
 * is module-scoped now.
 */
function winnerLine(page: Page) {
  return page.getByRole('heading', { level: 1, name: /^(Winner|Joint winners)$/ }).locator('+ *');
}

/** The leaderboard's dish names, top to bottom. */
async function leaderboard(page: Page): Promise<string[]> {
  const rows = page.getByRole('region', { name: 'Leaderboard' }).getByRole('listitem');
  await expect(rows.first()).toBeVisible();
  return (await rows.allInnerTexts()).map((row) => row.replace(/\s+/g, ' ').trim());
}

function content(name: string) {
  return {
    name,
    attribution: 'per_person',
    antiBias: 'none',
    // Host-triggered close, so the contest stays live until the host closes it.
    closeRule: { when: 'host_trigger' },
    scoring: {
      categories: [{ id: 'taste', name: 'Taste' }],
      range: { type: 'fixed', min: 1, max: 5 },
      uniquePerCategory: false,
    },
    participants: [
      { id: 'ana', displayName: 'Ana' },
      { id: 'bob', displayName: 'Bob' },
      { id: 'carmen', displayName: 'Carmen' },
    ],
  };
}

/** Has a participant claim a place, enter a dish, and optionally score and send. */
async function participantJoins(
  joinCode: string,
  contestId: string,
  id: string,
  vote?: { dishId: string; value: number }[],
): Promise<void> {
  const ctx: APIRequestContext = await playwrightRequest.newContext({ baseURL: API });
  await ctx.post(`/contests/${joinCode}/claim`, { data: { participantId: id } });
  await ctx.post(`/contests/${contestId}/dishes`, { data: { name: `${id} dish` } });
  if (vote) {
    for (const s of vote)
      await ctx.post(`/contests/${contestId}/scores`, {
        data: { dishId: s.dishId, categoryId: 'taste', value: s.value },
      });
    await ctx.post(`/contests/${contestId}/send-vote`);
  }
}

/** A host signed in on the host app, with a freshly published contest. */
async function publishContest(
  page: Page,
  email: string,
): Promise<{ contestId: string; joinCode: string }> {
  await hostInvitedBy(email, PASSWORD);
  await page.request.post(`${HOST_WEB}/auth/login`, { data: { email, password: PASSWORD } });
  const created = await page.request.post(`${HOST_WEB}/drafts`, {
    data: content('Balcony Cook-off'),
  });
  const published = await page.request.post(
    `${HOST_WEB}/drafts/${(await created.json()).id}/publish`,
  );
  const body = await published.json();
  return { contestId: body.id as string, joinCode: body.joinCode as string };
}

/** Bob and Carmen play through the API, both scoring Ana's dish highest — so "ana dish" wins. */
async function bobAndCarmenVote(joinCode: string, contestId: string): Promise<void> {
  await participantJoins(joinCode, contestId, 'bob', [
    { dishId: 'D-ana', value: 5 },
    { dishId: 'D-carmen', value: 2 },
  ]);
  await participantJoins(joinCode, contestId, 'carmen', [
    { dishId: 'D-ana', value: 5 },
    { dishId: 'D-bob', value: 2 },
  ]);
}

/**
 * A contest voted in and closed, with every place taken. Reveals it unless asked
 * not to. Use this when no participant needs to claim through a browser — Ana's
 * place is claimed here via the API, so the join screen would not offer her.
 */
async function seedContest(
  page: Page,
  email: string,
  opts: { reveal: boolean } = { reveal: true },
): Promise<{ contestId: string; joinCode: string }> {
  const { contestId, joinCode } = await publishContest(page, email);
  await participantJoins(joinCode, contestId, 'ana', [
    { dishId: 'D-bob', value: 3 },
    { dishId: 'D-carmen', value: 1 },
  ]);
  await bobAndCarmenVote(joinCode, contestId);

  await page.request.post(`${HOST_WEB}/contests/${contestId}/close`);
  if (opts.reveal) await page.request.post(`${HOST_WEB}/contests/${contestId}/reveal`);
  return { contestId, joinCode };
}

test('a host reaches the results from the contest and sees the winners', async ({ page }) => {
  const { contestId } = await seedContest(page, 'e2e-host-results@sobremesa.es');

  await page.goto(`${HOST_WEB}/contest/${contestId}`);
  await page.getByRole('link', { name: 'See the results' }).click();

  await expect(winnerLine(page)).toHaveText('ana dish');
  await expect(page.getByRole('region', { name: 'Leaderboard' }).getByRole('listitem')).toHaveCount(
    3,
  );
});

test('the host and a participant are shown the same winners, in the same order', async ({
  page,
  browser,
}) => {
  const { contestId, joinCode } = await publishContest(page, 'e2e-host-results-agree@sobremesa.es');
  await bobAndCarmenVote(joinCode, contestId);

  // Ana claims her place in a real browser, so the participant reads the results
  // through the app exactly as she would at the party. Her place has to be free
  // when she gets there, so it is deliberately NOT seeded through the API.
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(`${PARTICIPANT}/j/${joinCode}`);
  await guestPage.getByRole('button', { name: 'Ana' }).click();
  await expect(guestPage.getByRole('heading', { name: /your dish, ana/i })).toBeVisible();
  await guestPage.request.post(`${PARTICIPANT}/contests/${contestId}/dishes`, {
    data: { name: 'ana dish' },
  });

  await page.request.post(`${HOST_WEB}/contests/${contestId}/close`);
  await page.request.post(`${HOST_WEB}/contests/${contestId}/reveal`);

  await page.goto(`${HOST_WEB}/results/${contestId}`);
  await expect(winnerLine(page)).toHaveText('ana dish');
  const hostBoard = await leaderboard(page);

  await guestPage.goto(`${PARTICIPANT}/reveal`);
  await expect(winnerLine(guestPage)).toHaveText('ana dish');
  const participantBoard = await leaderboard(guestPage);

  expect(hostBoard).toEqual(participantBoard);
  await guest.close();
});

test('the results screen holds nothing before the reveal', async ({ page }) => {
  const { contestId } = await seedContest(page, 'e2e-host-results-early@sobremesa.es', {
    reveal: false,
  });

  await page.goto(`${HOST_WEB}/results/${contestId}`);

  await expect(page.getByRole('heading', { name: /aren’t out yet/i })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Leaderboard' })).toHaveCount(0);
});

test('the results screen is keyboard-operable and has no accessibility violations', async ({
  page,
}) => {
  const { contestId } = await seedContest(page, 'e2e-host-results-a11y@sobremesa.es');

  // Reduced motion neutralises the entrance animation, which is both the honoured
  // preference and a stable final frame for axe to measure contrast against.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${HOST_WEB}/results/${contestId}`);
  await expect(winnerLine(page)).toBeVisible();

  // The way back is reachable by keyboard.
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
