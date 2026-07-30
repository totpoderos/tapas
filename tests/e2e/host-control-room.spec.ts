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
 * Implements tests/e2e/host-control-room.feature against a real API + the host app
 * in a real browser.
 *
 * Each test seeds its own host. Where progress matters, participants really claim a
 * place and really send — the control room reads the same counts a host watches at
 * a venue, and seeding them another way would prove nothing about that path.
 */
const API = 'http://localhost:3100';
const PASSWORD = 'Str0ng!Passw0rd';

/**
 * A publishable draft. `host_trigger` keeps it live once votes land.
 *
 * `uniquePerCategory` is an option because it is stricter than it looks: with it
 * on, a category's scores must be a permutation of the band, so a fixed 1–10 band
 * cannot be satisfied by a judge with two dishes to score. Tests that vote turn it
 * off; the test that reads the rules leaves it on, which is the interesting case
 * for what the card says.
 */
function content(name: string, { uniquePerCategory = true } = {}) {
  return {
    name,
    attribution: 'per_person',
    antiBias: 'couples',
    closeRule: { when: 'host_trigger' },
    scoring: {
      categories: [
        { id: 'taste', name: 'Taste' },
        { id: 'look', name: 'Look' },
        { id: 'ambition', name: 'Ambition' },
      ],
      range: { type: 'fixed', min: 1, max: 10 },
      uniquePerCategory,
    },
    // Two couples: enough that the couples rule still leaves everyone something to score.
    participants: [
      { id: 'ana', displayName: 'Ana', partnerId: 'bob' },
      { id: 'bob', displayName: 'Bob', partnerId: 'ana' },
      { id: 'carmen', displayName: 'Carmen', partnerId: 'dani' },
      { id: 'dani', displayName: 'Dani', partnerId: 'carmen' },
    ],
  };
}

async function hostWithLiveContest(
  page: Page,
  email: string,
  name = 'Spring Tapas Crawl',
  options?: { uniquePerCategory?: boolean },
): Promise<{ contestId: string; joinCode: string }> {
  await hostInvitedBy(email, PASSWORD);
  await page.request.post('/auth/login', { data: { email, password: PASSWORD } });
  const created = await page.request.post('/drafts', { data: content(name, options) });
  const published = await page.request.post(`/drafts/${(await created.json()).id}/publish`);
  const body = await published.json();
  return { contestId: body.id as string, joinCode: body.joinCode as string };
}

/** A participant claims a place and enters a dish, in their own context. */
async function claimsAndCooks(
  joinCode: string,
  contestId: string,
  who: string,
): Promise<APIRequestContext> {
  const voter = await playwrightRequest.newContext({ baseURL: API });
  await voter.post(`/contests/${joinCode}/claim`, { data: { participantId: who } });
  await voter.post(`/contests/${contestId}/dishes`, { data: { name: `${who} dish` } });
  return voter;
}

/**
 * Scores every dish this judge is allowed to and sends.
 *
 * A distinct value per dish, because this contest uses a score only once in a
 * category — reusing one is refused, and a vote whose scores were refused stays
 * drafted, which would make a test asserting "one sent" pass as "none sent".
 */
async function sendsVote(voter: APIRequestContext, contestId: string): Promise<void> {
  const listed = await voter.get(`/contests/${contestId}/dishes`);
  const { dishes } = (await listed.json()) as { dishes: { dishId: string }[] };
  for (const [index, dish] of dishes.entries()) {
    for (const categoryId of ['taste', 'look', 'ambition']) {
      const scored = await voter.post(`/contests/${contestId}/scores`, {
        data: { dishId: dish.dishId, categoryId, value: index + 1 },
      });
      // Their own couple's dish is barred — a refusal to expect. Anything else
      // means the fixture is wrong rather than the rule working.
      expect(
        scored.ok() || scored.status() === 403,
        `scoring ${dish.dishId}/${categoryId}: ${scored.status()} ${await scored.text()}`,
      ).toBeTruthy();
    }
  }
  const sent = await voter.post(`/contests/${contestId}/send-vote`);
  expect(sent.ok(), `sending: ${sent.status()} ${await sent.text()}`).toBeTruthy();
}

/**
 * The panel's navigation. Its accessible name is something a screen-reader user
 * hears, so it is translated — which means a test in another language must say so.
 * The parameter exists to make that impossible to forget.
 */
const panel = (page: Page, named = 'Panel navigation') =>
  page.getByRole('navigation', { name: named });

test('the control room shows the join code and offers to copy it', async ({ page }) => {
  const { contestId, joinCode } = await hostWithLiveContest(page, 'e2e-room-code@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  await expect(page.getByText(joinCode)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy code' })).toBeVisible();
});

test('a revealed contest no longer shows a join code', async ({ page }) => {
  const { contestId, joinCode } = await hostWithLiveContest(page, 'e2e-room-revealed@sobremesa.es');
  await page.request.post(`/contests/${contestId}/close`);
  await page.request.post(`/contests/${contestId}/reveal`);

  await page.goto(`/contest/${contestId}`);
  await expect(page.getByRole('link', { name: 'See the results' })).toBeVisible();
  await expect(page.getByText(joinCode)).toHaveCount(0);
});

test('the control room shows how far along the voting is', async ({ page }) => {
  const { contestId, joinCode } = await hostWithLiveContest(
    page,
    'e2e-room-progress@sobremesa.es',
    'Spring Tapas Crawl',
    { uniquePerCategory: false },
  );
  const voters = [];
  for (const who of ['ana', 'bob', 'carmen', 'dani']) {
    voters.push(await claimsAndCooks(joinCode, contestId, who));
  }
  try {
    await sendsVote(voters[0]!, contestId);

    await page.goto(`/contest/${contestId}`);
    const progress = page.getByRole('region', { name: 'Progress' });
    // Four places, all claimed, one vote in — said in words as well as drawn.
    await expect(progress).toContainText('4 joined of 4 participants');
    await expect(progress).toContainText('1 of 4 votes sent');
    await expect(progress).toContainText('Sent');
    await expect(progress).toContainText('Scoring');
    await expect(progress).toContainText('Not joined');
  } finally {
    for (const voter of voters) await voter.dispose();
  }
});

test('the control room shows the rules the contest is being played by', async ({ page }) => {
  const { contestId } = await hostWithLiveContest(page, 'e2e-room-rules@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  const rules = page.getByRole('region', { name: 'Rules in force' });
  await expect(rules).toContainText('Per person');
  await expect(rules).toContainText('Couples can’t score each other');
  await expect(rules).toContainText('Taste, Look, Ambition');
  await expect(rules).toContainText('1–10');
  await expect(rules).toContainText('Unique per category');
});

test('the control room shows what has happened lately, and the way to all of it', async ({
  page,
}) => {
  const { contestId } = await hostWithLiveContest(page, 'e2e-room-activity@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  const recent = page.getByRole('region', { name: 'Recent activity' });
  await expect(recent).toContainText('Contest published');
  await expect(recent.getByRole('link', { name: 'Full log' })).toBeVisible();
});

test('closing asks first and says it cannot be undone', async ({ page }) => {
  const { contestId } = await hostWithLiveContest(page, 'e2e-room-close-ask@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  await page.getByRole('button', { name: 'Close voting' }).click();

  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('No more votes can be sent after this');
  await expect(dialog).toContainText('can’t be reopened');
});

test('backing out of closing leaves the contest live', async ({ page }) => {
  const { contestId } = await hostWithLiveContest(page, 'e2e-room-close-cancel@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  await page.getByRole('button', { name: 'Close voting' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(panel(page).getByText('Live')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reveal results' })).toBeDisabled();
});

test('closing is carried out once confirmed, and revealing becomes available', async ({ page }) => {
  const { contestId } = await hostWithLiveContest(page, 'e2e-room-close-do@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  await page.getByRole('button', { name: 'Close voting' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close voting' }).click();

  await expect(panel(page).getByText('Closed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reveal results' })).toBeEnabled();
});

test('revealing is shown but unavailable until the voting has closed', async ({ page }) => {
  const { contestId } = await hostWithLiveContest(page, 'e2e-room-reveal-wait@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  // Shown, so a host can see what comes next; disabled, so it cannot be taken —
  // by mouse or by keyboard.
  await expect(page.getByRole('button', { name: 'Reveal results' })).toBeDisabled();
});

test('revealing asks first and says it cannot be undone', async ({ page }) => {
  const { contestId } = await hostWithLiveContest(page, 'e2e-room-reveal-ask@sobremesa.es');
  await page.request.post(`/contests/${contestId}/close`);

  await page.goto(`/contest/${contestId}`);
  await page.getByRole('button', { name: 'Reveal results' }).click();

  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('visible to everyone');
  await expect(dialog).toContainText('can’t be undone');
});

test('once revealed, the results are the way onward', async ({ page }) => {
  const { contestId } = await hostWithLiveContest(page, 'e2e-room-onward@sobremesa.es');
  await page.request.post(`/contests/${contestId}/close`);
  await page.request.post(`/contests/${contestId}/reveal`);

  await page.goto(`/contest/${contestId}`);
  await expect(page.getByRole('button', { name: 'Close voting' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reveal results' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'See the results' })).toBeVisible();
});

test('deleting is kept apart from the rest, and says what it takes away', async ({ page }) => {
  const { contestId } = await hostWithLiveContest(page, 'e2e-room-danger@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  const danger = page.getByText('Danger zone').locator('..');
  await expect(danger).toContainText('votes and its log away for everyone');
  await expect(page.getByRole('button', { name: /^Delete/ })).toBeVisible();
});

test('the tally keeps up without the host reloading', async ({ page }) => {
  const { contestId, joinCode } = await hostWithLiveContest(page, 'e2e-room-keepup@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  const progress = page.getByRole('region', { name: 'Progress' });
  await expect(progress).toContainText('0 joined of 4 participants');
  // The panel says it is keeping itself up to date, so a host does not reload.
  await expect(page.getByText(/Tally updating/)).toBeVisible();

  const ana = await claimsAndCooks(joinCode, contestId, 'ana');
  try {
    // No reload: the control room re-reads the tally on its own.
    await expect(progress).toContainText('1 joined of 4 participants', { timeout: 10_000 });
  } finally {
    await ana.dispose();
  }
});

test('the control room is keyboard-operable and free of accessibility violations', async ({
  page,
}) => {
  const { contestId } = await hostWithLiveContest(page, 'e2e-room-a11y@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  await expect(page.getByRole('region', { name: 'Progress' })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);

  const close = page.getByRole('button', { name: 'Close voting' });
  await close.focus();
  await expect(close).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alertdialog')).toBeVisible();
});

test('the control room reads in Spanish', async ({ page }) => {
  const { contestId, joinCode } = await hostWithLiveContest(page, 'e2e-room-spanish@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  await page.getByLabel('Language').selectOption('es');

  await expect(page.getByRole('region', { name: 'Progreso' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Reglas en vigor' })).toContainText('Por persona');
  await expect(page.getByRole('button', { name: 'Cerrar la votación' })).toBeVisible();
  // What the host wrote, and what the system issued, are left alone. Scoped to the
  // navigation: the panel names the contest in its header too, so unscoped this
  // matches both — and both are the panel's, not this surface's.
  await expect(panel(page, 'Navegación del panel').getByText('Spring Tapas Crawl')).toBeVisible();
  await expect(page.getByText(joinCode)).toBeVisible();
});
