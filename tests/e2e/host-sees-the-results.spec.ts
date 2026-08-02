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
 * Implements tests/e2e/host-sees-the-results.feature. The host reads their
 * results on :5173 and a participant reads theirs on :5174, and the two are told
 * the same thing.
 *
 * This used to be true by construction: one `RevealView` drew both screens, so
 * the comparison could not fail for the reason it was written. The two apps have
 * since been separated — they are different products with different visual
 * languages — and the promise in `host-sees-the-results` now rests on these
 * tests instead of on the two screens being the same object.
 */
const API = 'http://localhost:3100';
const HOST_WEB = 'http://localhost:5173';
const PARTICIPANT = 'http://localhost:5174';
const PASSWORD = 'Str0ng!Passw0rd';

/*
 * Reading the winner and the leaderboard off each app.
 *
 * There are two of each on purpose. The two apps no longer share a component,
 * so a single helper pointed at both would be testing that they still happen to
 * produce the same markup — which is not what `host-sees-the-results` promises
 * and is precisely what stops being true when the participant app is restyled.
 * Each extractor reaches for its own app's screen; the assertion then compares
 * two facts obtained independently rather than one selector run twice.
 *
 * When a restyle moves something, fix the extractor for that app. If fixing it
 * makes the comparison pass again, the promise held. If it cannot be fixed
 * because the fact is no longer on the screen, the promise broke, and that is
 * the report this test exists to make.
 */

/** The host's winning dish: the line under the "Winner" / "Joint winners" heading. */
function hostWinner(page: Page) {
  return page.getByRole('heading', { level: 1, name: /^(Winner|Joint winners)$/ }).locator('+ *');
}

/**
 * The participant's winning dish — the h1 itself since the restyle. The two
 * screens now lead with different things: the host's headline is the word
 * "Winner" with the dish beneath it, the participant's headline IS the dish,
 * with "Winner" as a label above and the cook named below. Two locators, because
 * there are genuinely two drawings; one promise, checked against both.
 */
function participantWinner(page: Page) {
  return page.getByRole('heading', { level: 1 });
}

/** The leaderboard's rows, top to bottom, from whichever app is given. */
async function leaderboardOf(page: Page): Promise<string[]> {
  const rows = page.getByRole('region', { name: 'Leaderboard' }).getByRole('listitem');
  await expect(rows.first()).toBeVisible();
  return (await rows.allInnerTexts()).map((row) => row.replace(/\s+/g, ' ').trim());
}

/**
 * The order of the DISHES on a leaderboard, with the furniture around them
 * discarded.
 *
 * The two apps draw a row differently — rank alignment, where the total sits,
 * what is tinted — and are meant to. What may never differ is which dish comes
 * where, so that is what this compares. Reading raw row text instead would make
 * every restyle look like a broken promise, and the first person to see that
 * failure would rightly stop believing it.
 */
async function dishOrderOf(page: Page, dishes: readonly string[]): Promise<string[]> {
  const rows = await leaderboardOf(page);
  return rows.map((row) => dishes.find((dish) => row.includes(dish)) ?? `unrecognised: ${row}`);
}

function content(name: string) {
  return {
    name,
    format: 'solo',
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

  await expect(hostWinner(page)).toHaveText('ana dish');
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

  const dishes = ['ana dish', 'bob dish', 'carmen dish'];

  await page.goto(`${HOST_WEB}/results/${contestId}`);
  await expect(hostWinner(page)).toHaveText('ana dish');
  const hostBoard = await dishOrderOf(page, dishes);

  await guestPage.goto(`${PARTICIPANT}/reveal`);
  await expect(participantWinner(guestPage)).toHaveText('ana dish');
  const participantBoard = await dishOrderOf(guestPage, dishes);

  // Same dishes, same order, on two screens that no longer look alike.
  expect(hostBoard).toEqual(participantBoard);
  expect(hostBoard).toHaveLength(dishes.length);
  await guest.close();
});

/**
 * The same promise, checked so that it survives the two screens looking nothing
 * alike — which is what the participant restyle is about to make them.
 *
 * Comparing the two screens to each other, as the test above does, answers "do
 * they agree?" but not "which one is wrong?", and it quietly assumes the same
 * reading works on both. This one measures each screen against the results
 * themselves, separately. Neither app is the reference for the other; agreement
 * follows from each being faithful, and a failure names the app that drifted.
 *
 * It also deliberately reads the leaderboard by containment rather than by exact
 * row text: rank and total are drawn differently in the two apps as soon as
 * either is restyled, and the promise is about the order of the dishes, not
 * about the furniture around them.
 */
test('each screen is faithful to the results on its own, however it is drawn', async ({
  page,
  browser,
}) => {
  const { contestId, joinCode } = await publishContest(page, 'e2e-host-results-drawn@sobremesa.es');
  await bobAndCarmenVote(joinCode, contestId);

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

  // The outcome itself, which neither screen gets to define.
  const revealed = await (
    await page.request.get(`${HOST_WEB}/contests/${contestId}/winners`)
  ).json();
  const winner: string = revealed.overall.winners
    .map((w: { name: string }) => w.name)
    .join(' & ');
  const order: string[] = revealed.overall.standings.map((s: { name: string }) => s.name);
  expect(order.length).toBeGreaterThan(1); // a one-dish board could not show an order at all

  await page.goto(`${HOST_WEB}/results/${contestId}`);
  await expect(hostWinner(page)).toHaveText(winner);
  const hostBoard = await leaderboardOf(page);
  expect(hostBoard).toHaveLength(order.length);
  order.forEach((dish, i) => expect(hostBoard[i]).toContain(dish));

  await guestPage.goto(`${PARTICIPANT}/reveal`);
  await expect(participantWinner(guestPage)).toHaveText(winner);
  const participantBoard = await leaderboardOf(guestPage);
  expect(participantBoard).toHaveLength(order.length);
  order.forEach((dish, i) => expect(participantBoard[i]).toContain(dish));

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
  await expect(hostWinner(page)).toBeVisible();

  // The way back is reachable by keyboard.
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
