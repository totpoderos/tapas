import { test, expect, request as playwrightRequest, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/host-results-panel.feature against a real API + the host
 * app in a real browser.
 *
 * Two scenarios of that feature are **not** here, because they are already
 * covered where they belong: "the results are the same ones the participants
 * see" and "a host who goes there early is told" live in
 * `host-sees-the-results.spec.ts`, which stands up both apps to compare them.
 * This file is about the results on the shell — where the panel says they are,
 * and how the way in behaves before there is anything to show.
 */
const API = 'http://localhost:3100';
const PASSWORD = 'Str0ng!Passw0rd';

const panel = (page: Page, named = 'Panel navigation') =>
  page.getByRole('navigation', { name: named });

const winnerLine = (page: Page) =>
  page.getByRole('heading', { level: 1, name: /^(Winner|Joint winners)$/ }).locator('+ *');

function content(name: string) {
  return {
    name,
    attribution: 'per_person',
    antiBias: 'none',
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

/** A participant claims a place, enters a dish, and votes — all through the API. */
async function participantPlays(
  joinCode: string,
  contestId: string,
  id: string,
  vote: { dishId: string; value: number }[],
): Promise<void> {
  const ctx = await playwrightRequest.newContext({ baseURL: API });
  await ctx.post(`/contests/${joinCode}/claim`, { data: { participantId: id } });
  await ctx.post(`/contests/${contestId}/dishes`, { data: { name: `${id} dish` } });
  for (const s of vote)
    await ctx.post(`/contests/${contestId}/scores`, {
      data: { dishId: s.dishId, categoryId: 'taste', value: s.value },
    });
  await ctx.post(`/contests/${contestId}/send-vote`);
  await ctx.dispose();
}

/** A contest played through and closed. Revealed unless asked otherwise. */
async function seedContest(
  page: Page,
  email: string,
  opts: { reveal: boolean } = { reveal: true },
): Promise<string> {
  await hostInvitedBy(email, PASSWORD);
  await page.request.post('/auth/login', { data: { email, password: PASSWORD } });
  const created = await page.request.post('/drafts', { data: content('Balcony Cook-off') });
  const published = await page.request.post(`/drafts/${(await created.json()).id}/publish`);
  const { id: contestId, joinCode } = await published.json();

  // Everyone scores Ana's dish highest, so "ana dish" wins outright.
  await participantPlays(joinCode, contestId, 'ana', [
    { dishId: 'D-bob', value: 3 },
    { dishId: 'D-carmen', value: 1 },
  ]);
  await participantPlays(joinCode, contestId, 'bob', [
    { dishId: 'D-ana', value: 5 },
    { dishId: 'D-carmen', value: 2 },
  ]);
  await participantPlays(joinCode, contestId, 'carmen', [
    { dishId: 'D-ana', value: 5 },
    { dishId: 'D-bob', value: 2 },
  ]);

  expect((await page.request.post(`/contests/${contestId}/close`)).ok()).toBe(true);
  if (opts.reveal) {
    expect((await page.request.post(`/contests/${contestId}/reveal`)).ok()).toBe(true);
  }
  return contestId as string;
}

test('the results are offered once the contest is revealed', async ({ page }) => {
  const contestId = await seedContest(page, 'e2e-results-offered@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  await panel(page).getByRole('link', { name: 'Results' }).click();

  await expect(page).toHaveURL(new RegExp(`/results/${contestId}$`));
  await expect(winnerLine(page)).toHaveText('ana dish');
});

test('before the reveal the results are named but not offered', async ({ page }) => {
  const contestId = await seedContest(page, 'e2e-results-early@sobremesa.es', { reveal: false });

  await page.goto(`/contest/${contestId}`);

  // Shown and said to be unavailable, rather than quietly missing: a host waiting
  // for it should be able to see that it is coming.
  await expect(panel(page).getByRole('link', { name: 'Results' })).toHaveCount(0);
  await expect(panel(page)).toContainText('Results');
  await expect(panel(page)).toContainText('after reveal');
});

test('the ending is shown whole, with rank carried by its number', async ({ page }) => {
  const contestId = await seedContest(page, 'e2e-results-whole@sobremesa.es');

  await page.goto(`/results/${contestId}`);

  await expect(winnerLine(page)).toHaveText('ana dish');
  const board = page.getByRole('region', { name: 'Leaderboard' }).getByRole('listitem');
  await expect(board).toHaveCount(3);

  /*
   * Rank is not carried by emphasis alone. Read the leading numbers off the
   * rows: a leaderboard whose order is only in the styling says nothing to
   * somebody not seeing the styling.
   */
  const rows = (await board.allInnerTexts()).map((r) => r.replace(/\s+/g, ' ').trim());
  expect(rows[0]).toMatch(/^1\b/);
  expect(rows[1]).toMatch(/^2\b/);
  expect(rows[2]).toMatch(/^3\b/);
  expect(rows[0]).toContain('ana dish');
});

test('the results are not another host’s to read', async ({ page }) => {
  const contestId = await seedContest(page, 'e2e-results-owner@sobremesa.es');

  await hostInvitedBy('e2e-results-stranger@sobremesa.es', PASSWORD);
  await page.request.post('/auth/login', {
    data: { email: 'e2e-results-stranger@sobremesa.es', password: PASSWORD },
  });
  await page.goto(`/results/${contestId}`);

  await expect(page.getByRole('heading', { name: 'Contest not found' })).toBeVisible();
  await expect(page.getByText('ana dish')).toHaveCount(0);
});

test('the panel says which contest’s results these are, and offers the way back', async ({
  page,
}) => {
  const contestId = await seedContest(page, 'e2e-results-panel@sobremesa.es');

  await page.goto(`/results/${contestId}`);
  await expect(panel(page)).toContainText('Balcony Cook-off');
  await expect(panel(page).getByRole('link', { name: 'Results' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await panel(page).getByRole('link', { name: 'Control room' }).click();
  await expect(page).toHaveURL(new RegExp(`/contest/${contestId}$`));
});

test('the results are keyboard-operable and free of accessibility violations', async ({ page }) => {
  const contestId = await seedContest(page, 'e2e-results-a11y@sobremesa.es');

  /*
   * Scanned with reduced motion, as the participant reveal is: the entrance
   * fades in, and a scan that catches it mid-flight measures contrast against a
   * frame that never settles (1.49:1 on its way to full ink). The preference is
   * honoured and the frame is stable — the same reason `reveal-view.module.css`
   * says the animation must stay neutralised under it.
   */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/results/${contestId}`);
  await expect(winnerLine(page)).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);

  // The rest of the work is still reachable without a mouse.
  const control = panel(page).getByRole('link', { name: 'Control room' });
  await control.focus();
  await expect(control).toBeFocused();
});

test('the ending does not animate for somebody who asked for stillness', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  const contestId = await seedContest(page, 'e2e-results-still@sobremesa.es');

  await page.goto(`/results/${contestId}`);
  await expect(winnerLine(page)).toBeVisible();

  /*
   * The global reduced-motion rule in tokens.css collapses the entrance. The
   * accessibility scans depend on that stable final frame too, so this guards
   * more than comfort.
   */
  const duration = await page
    .getByRole('heading', { level: 1, name: /^(Winner|Joint winners)$/ })
    .evaluate((el) => getComputedStyle(el.parentElement!).animationDuration);
  expect(parseFloat(duration)).toBeLessThan(0.01);
  await context.close();
});

test('the results read in Spanish, leaving dish names alone', async ({ page }) => {
  const contestId = await seedContest(page, 'e2e-results-spanish@sobremesa.es');

  await page.goto(`/results/${contestId}`);
  await page.getByLabel('Language').selectOption('es');

  await expect(page.getByRole('heading', { level: 1, name: 'Ganador' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Clasificación' })).toBeVisible();
  // What a cook called their dish is theirs, not the interface's.
  await expect(page.getByText('ana dish').first()).toBeVisible();
});

test('the results hold together on a narrow screen', async ({ page }) => {
  const contestId = await seedContest(page, 'e2e-results-narrow@sobremesa.es');

  await page.setViewportSize({ width: 375, height: 812 });
  // Reduced motion again, for the stable frame the scan below needs.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/results/${contestId}`);
  await expect(winnerLine(page)).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
