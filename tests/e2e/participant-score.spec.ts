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

/*
 * Scoring is reached from the dish screen through the ways onward ("Your
 * scores"), not through a separate call to action. The dish screen used to
 * carry both; the redesign keeps only the ways onward, which every screen has
 * and which `participant-navigation` guards on its own.
 */

/** Per-person, no anti-bias, repeats allowed, fixed 1–5. Voter Ana may score everyone else. */
function repeatsAllowed(name: string, categories = [{ id: 'c1', name: 'Taste' }]) {
  return {
    name,
    format: 'solo',
    scoring: { categories, range: { type: 'fixed', min: 1, max: 5 }, uniquePerCategory: false },
    participants: [
      { id: 'a', displayName: 'Ana' },
      { id: 'b', displayName: 'Bruno' },
      { id: 'c', displayName: 'Carmen' },
    ],
  };
}

/*
 * Two categories, for the screen that shows what was given after sending. One
 * category cannot tell a row-per-dish list from a row-per-score one — they are
 * the same list — so the promise is only testable with more than one.
 */
const TWO_CATEGORIES = [
  { id: 'c1', name: 'Taste' },
  { id: 'c2', name: 'Texture' },
];

/**
 * Seeds a live contest and has the OTHER cooks (Ana, Carmen) submit dishes, so
 * they are scoreable — leaving Bruno's place open for the browser to join as.
 */
async function seedScorableContest(
  email: string,
  categories?: { id: string; name: string }[],
): Promise<{ joinCode: string; contestId: string; cooks: Map<string, APIRequestContext> }> {
  const host = await playwrightRequest.newContext({ baseURL: API });
  await hostInvitedBy(email, PASSWORD);
  await host.post('/auth/login', { data: { email, password: PASSWORD } });
  const created = await host.post('/drafts', { data: repeatsAllowed('Balcony Cook-off', categories) });
  const published = await host.post(`/drafts/${(await created.json()).id}/publish`);
  const body = await published.json();
  const joinCode = body.joinCode as string;
  const contestId = body.id as string;
  // Their contexts are handed back: a test that needs one of them to vote must
  // use the context that holds their claim, not claim the place a second time.
  const cooks = new Map<string, APIRequestContext>();
  for (const [pid, name] of [['a', 'Ana bravas'], ['c', 'Carmen gazpacho']] as const) {
    const cook: APIRequestContext = await playwrightRequest.newContext({ baseURL: API });
    await cook.post(`/contests/${joinCode}/claim`, { data: { participantId: pid } });
    await cook.post(`/contests/${contestId}/dishes`, { data: { name } });
    cooks.set(pid, cook);
  }
  return { joinCode, contestId, cooks };
}

/**
 * Scores every dish, a dish at a time.
 *
 * It walks the dishes by address rather than by clicking onward and re-querying:
 * clicking navigates, and a locator resolved just before the navigation is
 * resolved against a page that is on its way out. Moving between dishes with the
 * controls is worth testing on its own, and is — see "moves one dish at a time".
 */
async function scoreEveryDish(page: Page, value: string, dishes: number): Promise<void> {
  for (let dish = 1; dish <= dishes; dish++) {
    await page.goto(`${PARTICIPANT}/score/${dish}`);
    const groups = page.getByRole('radiogroup');
    await groups.first().waitFor();
    const count = await groups.count();
    for (let i = 0; i < count; i++) {
      await groups.nth(i).getByRole('radio', { name: value }).check();
    }
  }
  await page.goto(`${PARTICIPANT}/score`);
  await expect(page.getByRole('heading', { name: 'Your ballot' })).toBeVisible();
}

/** Opens the first dish's controls from the ballot. */
async function startScoring(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Your ballot' })).toBeVisible();
  await page.getByRole('link', { name: /Taste missing/i }).first().click();
}

test('a participant scores every open dish and sends their vote', async ({ page }) => {
  const { joinCode } = await seedScorableContest('e2e-score-send@sobremesa.es');
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await page.getByRole('navigation', { name: 'Go to' }).getByRole('link', { name: /^Score/ }).click();

  await scoreEveryDish(page, '4', 2);

  await page.getByRole('button', { name: 'Send my vote' }).click();
  await page.getByRole('button', { name: 'Yes, send my vote' }).click();
  await expect(page.getByText(/vote sent/i)).toBeVisible();
});

test('only scores within the allowed range are offered', async ({ page }) => {
  const { joinCode } = await seedScorableContest('e2e-score-range@sobremesa.es');
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await page.getByRole('navigation', { name: 'Go to' }).getByRole('link', { name: /^Score/ }).click();

  await startScoring(page);
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
  await page.getByRole('navigation', { name: 'Go to' }).getByRole('link', { name: /^Score/ }).click();
  await expect(page.getByRole('heading', { name: 'Your ballot' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Send my vote' })).toBeDisabled();
  // The ballot names what is missing rather than only refusing to send.
  await expect(page.getByRole('link', { name: /Taste missing/i }).first()).toBeVisible();
});

/**
 * The evening this broke: a contest that closes once everyone has voted used to
 * close as soon as the FIRST participant sent, because at that moment they were
 * often the only person who had claimed a place. Everybody still to arrive was
 * then locked out — a closed contest refuses scores and refuses dishes.
 *
 * `repeatsAllowed` names no close rule, so this contest gets the default
 * `all_sent`, which is exactly the configuration that has to be safe.
 */
test('someone who arrives after another has voted can still take part', async ({ page }) => {
  const { joinCode, contestId, cooks } = await seedScorableContest('e2e-score-latecomer@sobremesa.es');

  // Ana is first: she scores every dish open to her and sends.
  const ana = cooks.get('a')!;
  const ballot = await (await ana.get(`/contests/${contestId}/ballot`)).json();
  for (const dish of ballot.dishes as { dishId: string }[]) {
    await ana.post(`/contests/${contestId}/scores`, {
      data: { dishId: dish.dishId, categoryId: 'c1', value: 4 },
    });
  }
  expect((await ana.post(`/contests/${contestId}/send-vote`)).status()).toBe(200);

  // Bruno turns up afterwards. The contest must still be his to take part in.
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await expect(page.getByRole('heading', { name: /your dish, bruno/i })).toBeVisible();

  await scoreEveryDish(page, '5', 2);
  await page.getByRole('button', { name: 'Send my vote' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, send my vote' }).click();
  await expect(page.getByText(/vote sent/i)).toBeVisible();
});

test('a sent vote is locked and cannot be sent again', async ({ page }) => {
  const { joinCode } = await seedScorableContest('e2e-score-locked@sobremesa.es');
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await page.getByRole('navigation', { name: 'Go to' }).getByRole('link', { name: /^Score/ }).click();
  await scoreEveryDish(page, '4', 2);
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
  await page.getByRole('navigation', { name: 'Go to' }).getByRole('link', { name: /^Score/ }).click();
  await startScoring(page);

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);

  await scoreEveryDish(page, '5', 2);
  await page.getByRole('button', { name: 'Send my vote' }).click();
  await page.getByRole('button', { name: 'Yes, send my vote' }).click();
  await expect(page.getByText(/vote sent/i)).toBeVisible();
});

test('scoring moves one dish at a time, forwards and back', async ({ page }) => {
  const { joinCode } = await seedScorableContest('e2e-score-paging@sobremesa.es');
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  // Wait for the claim to land: navigating first loses the remembered contest
  // and the app rightly answers "join first".
  await expect(page.getByRole('heading', { name: /your dish, bruno/i })).toBeVisible();
  await page.goto(`${PARTICIPANT}/score/1`);

  await expect(page.getByText('Dish 1 of 2')).toBeVisible();
  const firstDish = await page.getByRole('heading', { level: 1 }).innerText();

  await page.getByRole('link', { name: /next dish/i }).click();
  await expect(page.getByText('Dish 2 of 2')).toBeVisible();
  expect(await page.getByRole('heading', { level: 1 }).innerText()).not.toBe(firstDish);

  // Back goes to the dish before, not out of the app.
  await page.getByRole('link', { name: /previous dish/i }).click();
  await expect(page.getByText('Dish 1 of 2')).toBeVisible();
});

test('reloading keeps a participant on the same dish', async ({ page }) => {
  const { joinCode } = await seedScorableContest('e2e-score-reload@sobremesa.es');
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await expect(page.getByRole('heading', { name: /your dish, bruno/i })).toBeVisible();

  await page.goto(`${PARTICIPANT}/score/2`);
  await expect(page.getByText('Dish 2 of 2')).toBeVisible();
  const dish = await page.getByRole('heading', { level: 1 }).innerText();

  await page.reload();
  await expect(page.getByText('Dish 2 of 2')).toBeVisible();
  expect(await page.getByRole('heading', { level: 1 }).innerText()).toBe(dish);
});

test('the ballot names what is missing and leads there', async ({ page }) => {
  const { joinCode } = await seedScorableContest('e2e-score-missing@sobremesa.es');
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await expect(page.getByRole('heading', { name: /your dish, bruno/i })).toBeVisible();

  // Score the first dish only, so exactly one thing is outstanding.
  await page.goto(`${PARTICIPANT}/score/1`);
  await page.getByRole('radiogroup').first().getByRole('radio', { name: '4' }).check();
  await page.goto(`${PARTICIPANT}/score`);

  const second = await page.goto(`${PARTICIPANT}/score/2`).then(() =>
    page.getByRole('heading', { level: 1 }).innerText(),
  );
  await page.goto(`${PARTICIPANT}/score`);

  // Named, not merely refused.
  await expect(page.getByText(new RegExp(`Taste is still missing for ${second}`, 'i'))).toBeVisible();

  // And following it lands on that dish, with that category ready.
  await page.getByRole('link', { name: /Taste missing/i }).click();
  await expect(page.getByText('Dish 2 of 2')).toBeVisible();
  await expect(page.getByRole('radiogroup').first().getByRole('radio', { name: '1' })).toBeFocused();
});

test('sending is confirmed, and declining changes nothing', async ({ page }) => {
  const { joinCode } = await seedScorableContest('e2e-score-decline@sobremesa.es');
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await expect(page.getByRole('heading', { name: /your dish, bruno/i })).toBeVisible();
  await scoreEveryDish(page, '4', 2);

  await page.getByRole('button', { name: 'Send my vote' }).click();
  await page.getByRole('button', { name: /not yet/i }).click();

  // Nothing sent, and the ballot is as it was.
  await expect(page.getByRole('button', { name: 'Send my vote' })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Send my vote' })).toBeEnabled();
});

test('the confirmation holds the keyboard while it is open', async ({ page }) => {
  const { joinCode } = await seedScorableContest('e2e-score-trap@sobremesa.es');
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await expect(page.getByRole('heading', { name: /your dish, bruno/i })).toBeVisible();
  await scoreEveryDish(page, '4', 2);

  await page.getByRole('button', { name: 'Send my vote' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeFocused(); // the question is announced before either answer

  /*
   * Round the sheet's own two choices and back to the first, in a real browser
   * rather than in a simulated tab order. Past the last one it must wrap, not
   * step out onto the ballot behind — where the very control that opened this
   * is still sitting, one Tab and one Enter from an unconfirmed send.
   */
  for (const name of ['Yes, send my vote', 'Not yet', 'Yes, send my vote']) {
    await page.keyboard.press('Tab');
    await expect(sheet.getByRole('button', { name })).toBeFocused();
  }
  await page.keyboard.press('Shift+Tab');
  await expect(sheet.getByRole('button', { name: 'Not yet' })).toBeFocused();
});

test('the confirmation can be dismissed from the keyboard', async ({ page }) => {
  const { joinCode } = await seedScorableContest('e2e-score-escape@sobremesa.es');
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await expect(page.getByRole('heading', { name: /your dish, bruno/i })).toBeVisible();
  await scoreEveryDish(page, '4', 2);

  await page.getByRole('button', { name: 'Send my vote' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  // Gone, nothing sent, and focus back on what opened it rather than adrift.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send my vote' })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Send my vote' })).toBeEnabled();
});

test('a sent vote shows what was given, dish by dish', async ({ page }) => {
  const { joinCode } = await seedScorableContest('e2e-score-record@sobremesa.es', TWO_CATEGORIES);
  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Bruno' }).click();
  await expect(page.getByRole('heading', { name: /your dish, bruno/i })).toBeVisible();
  await scoreEveryDish(page, '4', 2); // both categories of both dishes

  await page.getByRole('button', { name: 'Send my vote' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, send my vote' }).click();

  const record = page.getByRole('list', { name: 'Your vote is in' });
  // Two dishes, two rows — where a row-per-score list would give four.
  await expect(record.getByRole('listitem')).toHaveCount(2);
  await expect(record.getByText('Taste 4 · Texture 4').first()).toBeVisible();
  // Named as theirs: the reveal will show this dish carrying every judge.
  await expect(record.getByText('you gave 8').first()).toBeVisible();
});
