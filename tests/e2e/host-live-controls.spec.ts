import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * The winning dish's name. It also appears on the leaderboard below, so it needs
 * disambiguating — anchored to the "Winner" heading it sits under rather than to
 * a class name, since the reveal moved into `@tapas/ui` and its styles are
 * module-scoped now. "The winner is named directly beneath the Winner heading"
 * is the actual promise to a screen-reader user, and it survives the move.
 */
function winnerLine(page: Page) {
  return page.getByRole('heading', { level: 1, name: /^(Winner|Joint winners)$/ }).locator('+ *');
}

/**
 * Implements tests/e2e/host-live-controls.feature. The host drives a live
 * contest from the host app (:5173) — watching the tally, closing, revealing —
 * while participant activity is seeded through API contexts. The final scenario
 * shows the host's reveal lighting up a waiting participant on :5174.
 */
const API = 'http://localhost:3100';
const HOST_WEB = 'http://localhost:5173';
const PARTICIPANT = 'http://localhost:5174';
const PASSWORD = 'Str0ng!Passw0rd';

function content(name: string) {
  return {
    name,
    attribution: 'per_person',
    antiBias: 'none',
    // Host-triggered close, so the contest stays live until the host closes it
    // (the default `all_sent` would auto-close the moment the first voter sends).
    closeRule: { when: 'host_trigger' },
    scoring: { categories: [{ id: 'taste', name: 'Taste' }], range: { type: 'fixed', min: 1, max: 5 }, uniquePerCategory: false },
    participants: [
      { id: 'ana', displayName: 'Ana' },
      { id: 'bob', displayName: 'Bob' },
      { id: 'carmen', displayName: 'Carmen' },
    ],
  };
}

/** Signs the host in through the app (:5173, first-party cookie) and returns their id + join code, live. */
async function hostWithLiveContest(page: Page, email: string): Promise<{ contestId: string; joinCode: string }> {
  await hostInvitedBy(email, PASSWORD);
  await page.request.post(`${HOST_WEB}/auth/login`, { data: { email, password: PASSWORD } });
  const created = await page.request.post(`${HOST_WEB}/drafts`, { data: content('Balcony Cook-off') });
  const published = await page.request.post(`${HOST_WEB}/drafts/${(await created.json()).id}/publish`);
  const body = await published.json();
  return { contestId: body.id as string, joinCode: body.joinCode as string };
}

/** Has a participant claim a place (and optionally send a vote) via their own API context. */
async function participantJoins(joinCode: string, contestId: string, id: string, vote?: { dishId: string; value: number }[]): Promise<void> {
  const ctx: APIRequestContext = await playwrightRequest.newContext({ baseURL: API });
  await ctx.post(`/contests/${joinCode}/claim`, { data: { participantId: id } });
  await ctx.post(`/contests/${contestId}/dishes`, { data: { name: `${id} dish` } });
  if (vote) {
    for (const s of vote) await ctx.post(`/contests/${contestId}/scores`, { data: { dishId: s.dishId, categoryId: 'taste', value: s.value } });
    await ctx.post(`/contests/${contestId}/send-vote`);
  }
}

test('a host watches the tally of a running contest', async ({ page }) => {
  const { contestId, joinCode } = await hostWithLiveContest(page, 'e2e-live-tally@sobremesa.es');
  await participantJoins(joinCode, contestId, 'ana', [{ dishId: 'D-bob', value: 5 }, { dishId: 'D-carmen', value: 4 }]);
  await participantJoins(joinCode, contestId, 'bob');

  await page.goto(`${HOST_WEB}/contest/${contestId}`);
  // Progress is a named region now, and says its counts against the roster's size
  // rather than as bare labels — see host-control-room.spec.ts for the detail.
  const progress = page.getByRole('region', { name: 'Progress' });
  await expect(progress).toContainText('2 joined of 3 participants');
  await expect(progress).toContainText('Votes sent');
  await expect(page.getByText(joinCode)).toBeVisible();
});

test('a host closes voting on a running contest', async ({ page }) => {
  const { contestId } = await hostWithLiveContest(page, 'e2e-live-close@sobremesa.es');
  await page.goto(`${HOST_WEB}/contest/${contestId}`);

  await page.getByRole('button', { name: 'Close voting' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close voting' }).click();

  // The panel says the state; the surface no longer repeats it, so this asks the
  // panel. The scoping this needed while both said it is gone with the duplicate.
  await expect(page.getByRole('navigation', { name: 'Panel navigation' }).getByText('Closed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reveal results' })).toBeVisible();
});

test('closing is confirmed first — cancelling leaves it live', async ({ page }) => {
  const { contestId } = await hostWithLiveContest(page, 'e2e-live-cancel@sobremesa.es');
  await page.goto(`${HOST_WEB}/contest/${contestId}`);

  await page.getByRole('button', { name: 'Close voting' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Panel navigation' }).getByText('Live')).toBeVisible();
});

test('a host reveals, and a waiting participant sees the results appear', async ({ page, browser }) => {
  const { contestId, joinCode } = await hostWithLiveContest(page, 'e2e-live-reveal@sobremesa.es');
  await participantJoins(joinCode, contestId, 'bob', [{ dishId: 'D-ana', value: 5 }, { dishId: 'D-carmen', value: 2 }]);

  // A participant (Ana) joins on the participant app and waits on the reveal screen.
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(`${PARTICIPANT}/j/${joinCode}`);
  await guestPage.getByRole('button', { name: 'Ana' }).click();
  await expect(guestPage.getByRole('heading', { name: /your dish, ana/i })).toBeVisible(); // join landed
  await guestPage.goto(`${PARTICIPANT}/reveal`);
  await expect(guestPage.getByText(/almost there/i)).toBeVisible();

  // The host closes and reveals from the control room.
  await page.goto(`${HOST_WEB}/contest/${contestId}`);
  await page.getByRole('button', { name: 'Close voting' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close voting' }).click();
  await expect(page.getByRole('button', { name: 'Reveal results' })).toBeVisible();
  await page.getByRole('button', { name: 'Reveal results' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reveal results' }).click();
  await expect(page.getByText(/results are out/i)).toBeVisible();

  // The participant's waiting screen picks up the reveal without reloading.
  await expect(winnerLine(guestPage)).toBeVisible({ timeout: 10_000 });
  await guest.close();
});

test('the control room is keyboard-operable and has no accessibility violations', async ({ page }) => {
  const { contestId } = await hostWithLiveContest(page, 'e2e-live-a11y@sobremesa.es');
  await page.goto(`${HOST_WEB}/contest/${contestId}`);
  // The contest's name is the panel's to say; the surface waits on its own content.
  await expect(page.getByRole('region', { name: 'Progress' })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
});
