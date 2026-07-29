import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/participant-score.feature. A repeats-allowed contest is
 * seeded (uniquePerCategory: false, fixed 1–5 range), every cook submits a dish
 * so the ballot is scoreable, and the joiner is driven through scoring + send on
 * the participant app.
 */
const API = 'http://localhost:3100';
const PARTICIPANT = 'http://localhost:5174';
const PASSWORD = 'Str0ng!Passw0rd';

/** Per-person, no anti-bias, repeats allowed, fixed 1–5. Voter Ana may score everyone else. */
function repeatsAllowed(name: string) {
  return {
    name,
    attribution: 'per_person',
    antiBias: 'none',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'fixed', min: 1, max: 5 }, uniquePerCategory: false },
    participants: [
      { id: 'a', displayName: 'Ana' },
      { id: 'b', displayName: 'Bruno' },
      { id: 'c', displayName: 'Carmen' },
    ],
  };
}

/**
 * Seeds a live contest and has the OTHER cooks (Ana, Carmen) submit dishes, so
 * they are scoreable — leaving Bruno's place open for the browser to join as.
 */
async function seedScorableContest(email: string): Promise<{ joinCode: string; contestId: string }> {
  const host = await playwrightRequest.newContext({ baseURL: API });
  await hostInvitedBy(email, PASSWORD);
  await host.post('/auth/login', { data: { email, password: PASSWORD } });
  const created = await host.post('/drafts', { data: repeatsAllowed('Balcony Cook-off') });
  const published = await host.post(`/drafts/${(await created.json()).id}/publish`);
  const body = await published.json();
  const joinCode = body.joinCode as string;
  const contestId = body.id as string;
  for (const [pid, name] of [['a', 'Ana bravas'], ['c', 'Carmen gazpacho']] as const) {
    const cook: APIRequestContext = await playwrightRequest.newContext({ baseURL: API });
    await cook.post(`/contests/${joinCode}/claim`, { data: { participantId: pid } });
    await cook.post(`/contests/${contestId}/dishes`, { data: { name } });
  }
  return { joinCode, contestId };
}

async function scoreEveryDish(page: Page, value: string): Promise<void> {
  const groups = page.getByRole('radiogroup');
  await groups.first().waitFor(); // the ballot has rendered
  const count = await groups.count();
  for (let i = 0; i < count; i++) {
    await groups.nth(i).getByRole('radio', { name: value }).check();
  }
}

test('a participant scores every open dish and sends their vote', async ({ page }) => {
  const { joinCode } = await seedScorableContest('e2e-score-send@sobremesa.es');
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await page.getByRole('link', { name: /score the dishes/i }).click();

  await expect(page.getByRole('heading', { name: 'Score the dishes' })).toBeVisible();
  await scoreEveryDish(page, '4');

  await page.getByRole('button', { name: 'Send my vote' }).click();
  await page.getByRole('button', { name: 'Yes, send my vote' }).click();
  await expect(page.getByText(/vote sent/i)).toBeVisible();
});

test('only scores within the allowed range are offered', async ({ page }) => {
  const { joinCode } = await seedScorableContest('e2e-score-range@sobremesa.es');
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await page.getByRole('link', { name: /score the dishes/i }).click();

  const firstGroup = page.getByRole('radiogroup').first();
  await expect(firstGroup.getByRole('radio')).toHaveCount(5); // 1..5
  await expect(firstGroup.getByRole('radio', { name: '5' })).toBeVisible();
  await expect(firstGroup.getByRole('radio', { name: '6' })).toHaveCount(0);
  await expect(firstGroup.getByRole('radio', { name: '0' })).toHaveCount(0);
});

test('a vote cannot be sent until every dish is scored', async ({ page }) => {
  const { joinCode } = await seedScorableContest('e2e-score-incomplete@sobremesa.es');
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await page.getByRole('link', { name: /score the dishes/i }).click();
  await expect(page.getByRole('heading', { name: 'Score the dishes' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Send my vote' })).toBeDisabled();
  await page.getByRole('radiogroup').first().getByRole('radio', { name: '3' }).check();
  await expect(page.getByRole('button', { name: 'Send my vote' })).toBeDisabled(); // still one unscored
});

test('a sent vote is locked and cannot be sent again', async ({ page }) => {
  const { joinCode } = await seedScorableContest('e2e-score-locked@sobremesa.es');
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await page.getByRole('link', { name: /score the dishes/i }).click();
  await scoreEveryDish(page, '4');
  await page.getByRole('button', { name: 'Send my vote' }).click();
  await page.getByRole('button', { name: 'Yes, send my vote' }).click();
  await expect(page.getByText(/vote sent/i)).toBeVisible();

  // Locked: no send control, and reopening the score screen stays sent.
  await expect(page.getByRole('button', { name: 'Send my vote' })).toHaveCount(0);
  await expect(page.getByRole('radiogroup')).toHaveCount(0);
});

test('scoring is keyboard-operable and has no accessibility violations', async ({ page }) => {
  const { joinCode } = await seedScorableContest('e2e-score-a11y@sobremesa.es');
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await page.getByRole('link', { name: /score the dishes/i }).click();
  await expect(page.getByRole('heading', { name: 'Score the dishes' })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);

  await scoreEveryDish(page, '5');
  await page.getByRole('button', { name: 'Send my vote' }).click();
  await page.getByRole('button', { name: 'Yes, send my vote' }).click();
  await expect(page.getByText(/vote sent/i)).toBeVisible();
});
