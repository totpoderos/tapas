import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/accessibility-reflow.feature — WCAG 2.1 AA success
 * criterion **1.4.10 Reflow**: at 320 CSS pixels of width (equivalent to a
 * 640px viewport zoomed to 200%), content must reflow into one column with no
 * horizontal scrolling, and everything must stay operable.
 *
 * This is the criterion the participant app most needs and the one axe cannot
 * check for you — axe evaluates the DOM it is given, it does not resize the
 * viewport. So we drive the real screens at 320px and assert both the *absence*
 * of a sideways scrollbar and that the journey still completes.
 *
 * 320×512 is the WCAG-referenced small-screen target (1280px wide at 400% /
 * 640px at 200%).
 */
const API = 'http://localhost:3100';
const PARTICIPANT = 'http://localhost:5174';
const PASSWORD = 'Str0ng!Passw0rd';
const NARROW = { width: 320, height: 512 };

function repeatsAllowed(name: string) {
  return {
    name,
    attribution: 'per_person',
    antiBias: 'none',
    scoring: {
      categories: [{ id: 'c1', name: 'Taste' }],
      range: { type: 'fixed', min: 1, max: 5 },
      uniquePerCategory: false,
    },
    closeRule: { when: 'host_trigger' },
    participants: [
      { id: 'a', displayName: 'Ana' },
      { id: 'b', displayName: 'Bruno' },
      { id: 'c', displayName: 'Carmen' },
    ],
  };
}

/** Seeds a live contest with the other cooks' dishes in, leaving Bruno free to join as. */
async function seedScorableContest(email: string) {
  const host: APIRequestContext = await playwrightRequest.newContext({ baseURL: API });
  await hostInvitedBy(email, PASSWORD);
  await host.post('/auth/login', { data: { email, password: PASSWORD } });
  const created = await host.post('/drafts', { data: repeatsAllowed('Reflow Cook-off') });
  const published = await host.post(`/drafts/${(await created.json()).id}/publish`);
  const body = await published.json();
  for (const [pid, dish] of [
    ['a', 'Ana bravas'],
    ['c', 'Carmen gazpacho'],
  ] as const) {
    const cook: APIRequestContext = await playwrightRequest.newContext({ baseURL: API });
    await cook.post(`/contests/${body.joinCode}/claim`, { data: { participantId: pid } });
    await cook.post(`/contests/${body.id}/dishes`, { data: { name: dish } });
  }
  return { host, joinCode: body.joinCode as string, contestId: body.id as string };
}

/**
 * True when the document scrolls horizontally. A 1px tolerance keeps sub-pixel
 * rounding from failing an otherwise-clean layout.
 */
async function scrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
}

/** Scores every dish by address, then returns to the ballot where sending lives. */
async function scoreEveryDishNarrow(page: Page, value: string, dishes = 2): Promise<void> {
  for (let dish = 1; dish <= dishes; dish++) {
    await page.goto(`${PARTICIPANT}/score/${dish}`);
    const groups = page.getByRole('radiogroup');
    await groups.first().waitFor();
    const count = await groups.count();
    for (let i = 0; i < count; i++) {
      await groups.nth(i).getByRole('radio', { name: value }).check();
    }
    expect(await scrollsSideways(page)).toBe(false);
  }
  await page.goto(`${PARTICIPANT}/score`);
}

test('scoring reflows to a narrow screen and stays operable', async ({ page }) => {
  const { joinCode } = await seedScorableContest('e2e-reflow-score@sobremesa.es');
  await page.setViewportSize(NARROW);

  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await page.getByRole('link', { name: 'Your scores' }).click();
  await expect(page.getByRole('heading', { name: 'Your ballot' })).toBeVisible();

  expect(await scrollsSideways(page)).toBe(false);

  /*
   * Still fully operable at this width, a dish at a time. The track's ten step
   * labels are the thing this width is meant to catch: below 360px they drop to
   * the ends, and the control itself does not change.
   */
  await scoreEveryDishNarrow(page, '4');
  await page.getByRole('button', { name: 'Send my vote' }).click();
  await page.getByRole('button', { name: 'Yes, send my vote' }).click();
  await expect(page.getByText(/vote sent/i)).toBeVisible();

  expect(await scrollsSideways(page)).toBe(false);
});

test('the reveal reflows to a narrow screen and still announces the winner', async ({ page }) => {
  const { host, joinCode, contestId } = await seedScorableContest('e2e-reflow-reveal@sobremesa.es');
  await page.setViewportSize(NARROW);

  // Join and vote, then the host closes and reveals.
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await page.getByRole('link', { name: 'Your scores' }).click();
  await scoreEveryDishNarrow(page, '5');
  await page.getByRole('button', { name: 'Send my vote' }).click();
  await page.getByRole('button', { name: 'Yes, send my vote' }).click();
  await expect(page.getByText(/vote sent/i)).toBeVisible();

  await host.post(`/contests/${contestId}/close`);
  await host.post(`/contests/${contestId}/reveal`);

  await page.getByRole('link', { name: /see the results/i }).click();
  await expect(page.getByRole('heading', { name: /^(winner|joint winners)$/i })).toBeVisible();

  expect(await scrollsSideways(page)).toBe(false);
});

test('the join screen reflows with the language control in the header', async ({ page }) => {
  // The control now rides in the header beside the brand rather than floating in
  // the corner, so at 320px it shares a row with the wordmark. It must still fit
  // without pushing the document sideways, and must not crowd the heading out.
  //
  // There is no theme control any more: the participant app is light only.
  await page.setViewportSize(NARROW);
  await page.goto(PARTICIPANT);

  await expect(page.getByRole('heading', { name: 'Join the contest' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'English' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Español' })).toBeVisible();

  expect(await scrollsSideways(page)).toBe(false);
});
