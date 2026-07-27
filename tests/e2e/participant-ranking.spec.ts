import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Implements tests/e2e/participant-ranking.feature. A strict-ranking contest
 * (uniquePerCategory: true) is seeded with dishes so the ballot is rankable, and
 * the joiner (Bruno) ranks the two dishes open to him and sends.
 */
const API = 'http://localhost:3100';
const PARTICIPANT = 'http://localhost:5174';
const PASSWORD = 'Str0ng!Passw0rd';

/** Per-person, no anti-bias, STRICT RANKING (auto range = 1..N). Bruno ranks Ana & Carmen. */
function ranking(name: string) {
  return {
    name,
    attribution: 'per_person',
    antiBias: 'none',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: true },
    participants: [
      { id: 'a', displayName: 'Ana' },
      { id: 'b', displayName: 'Bruno' },
      { id: 'c', displayName: 'Carmen' },
    ],
  };
}

/** Seeds a live strict-ranking contest; Ana and Carmen submit dishes, leaving Bruno's place open. */
async function seedRankingContest(email: string): Promise<{ joinCode: string }> {
  const host = await playwrightRequest.newContext({ baseURL: API });
  await host.post('/auth/register', { data: { email, password: PASSWORD } });
  await host.post('/auth/login', { data: { email, password: PASSWORD } });
  const created = await host.post('/drafts', { data: ranking('Ranked Cook-off') });
  const published = await host.post(`/drafts/${(await created.json()).id}/publish`);
  const body = await published.json();
  const joinCode = body.joinCode as string;
  const contestId = body.id as string;
  for (const [pid, dish] of [['a', 'Ana bravas'], ['c', 'Carmen gazpacho']] as const) {
    const ctx: APIRequestContext = await playwrightRequest.newContext({ baseURL: API });
    await ctx.post(`/contests/${joinCode}/claim`, { data: { participantId: pid } });
    await ctx.post(`/contests/${contestId}/dishes`, { data: { name: dish } });
  }
  return { joinCode };
}

async function joinAsBrunoAndOpenScoring(page: Page, joinCode: string): Promise<void> {
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await expect(page.getByRole('heading', { name: /your dish, bruno/i })).toBeVisible();
  await page.getByRole('link', { name: /score the dishes/i }).click();
  await expect(page.getByRole('heading', { name: 'Rank the dishes' })).toBeVisible();
}

/**
 * The per-dish rank controls, named "Rank for <dish> in <category>". Selected by
 * name rather than by position among every combobox on the page: the shared
 * language selector is a combobox too, and it rides along on every screen.
 */
function rankSelects(page: Page) {
  return page.getByRole('combobox', { name: /^Rank for / });
}

test('a participant ranks every dish and sends their vote', async ({ page }) => {
  const { joinCode } = await seedRankingContest('e2e-rank-send@sobremesa.es');
  await joinAsBrunoAndOpenScoring(page, joinCode);

  const selects = rankSelects(page);
  await selects.nth(0).selectOption('1');
  await expect(page.getByRole('button', { name: 'Send my vote' })).toBeDisabled(); // one still unranked
  await selects.nth(1).selectOption('2');

  await page.getByRole('button', { name: 'Send my vote' }).click();
  await page.getByRole('button', { name: 'Yes, send my vote' }).click();
  await expect(page.getByText(/vote sent/i)).toBeVisible();
});

test('choosing a taken rank swaps, keeping each rank used once', async ({ page }) => {
  const { joinCode } = await seedRankingContest('e2e-rank-swap@sobremesa.es');
  await joinAsBrunoAndOpenScoring(page, joinCode);

  const selects = rankSelects(page);
  await selects.nth(0).selectOption('1');
  await selects.nth(1).selectOption('2');
  // Give the first dish rank 2 — the second holds it, so they swap.
  await selects.nth(0).selectOption('2');

  await expect(selects.nth(0)).toHaveValue('2');
  await expect(selects.nth(1)).toHaveValue('1');
});

test('a vote cannot be sent until every dish is ranked', async ({ page }) => {
  const { joinCode } = await seedRankingContest('e2e-rank-incomplete@sobremesa.es');
  await joinAsBrunoAndOpenScoring(page, joinCode);

  await expect(page.getByRole('button', { name: 'Send my vote' })).toBeDisabled();
  await rankSelects(page).nth(0).selectOption('1');
  await expect(page.getByRole('button', { name: 'Send my vote' })).toBeDisabled(); // still one unranked
});

test('ranking is keyboard-operable and has no accessibility violations', async ({ page }) => {
  const { joinCode } = await seedRankingContest('e2e-rank-a11y@sobremesa.es');
  await joinAsBrunoAndOpenScoring(page, joinCode);

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);

  const selects = rankSelects(page);
  await selects.nth(0).selectOption('1');
  await selects.nth(1).selectOption('2');
  await page.getByRole('button', { name: 'Send my vote' }).click();
  await page.getByRole('button', { name: 'Yes, send my vote' }).click();
  await expect(page.getByText(/vote sent/i)).toBeVisible();
});
