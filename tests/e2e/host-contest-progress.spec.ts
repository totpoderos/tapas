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
 * Implements tests/e2e/host-contest-progress.feature against a real API + the
 * host app in a real browser.
 *
 * Each test seeds its own host, so contests never leak between them. Where a test
 * needs votes, participants really claim a place and really send — the counts on
 * the list are read from that, and seeding them any other way would prove nothing
 * about the path a host actually watches.
 */
const API = 'http://localhost:3100';
const PASSWORD = 'Str0ng!Passw0rd';

/** A publishable draft. `closeRule: host_trigger` keeps it live once votes land. */
function content(
  name: string,
  options: { categories?: number; format?: 'solo' | 'solo_with_partners' | 'couples' } = {},
) {
  const couples = options.format === 'couples';
  return {
    name,
    format: options.format ?? 'solo',
    // The default `all_sent` would close the contest once every place had sent,
    // and these tests are about a contest still running.
    closeRule: { when: 'host_trigger' },
    scoring: {
      categories: Array.from({ length: options.categories ?? 1 }, (_, i) => ({
        id: i === 0 ? 'taste' : `c${i}`,
        name: i === 0 ? 'Taste' : `Category ${i}`,
      })),
      range: { type: 'fixed', min: 1, max: 5 },
      uniquePerCategory: false,
    },
    // Four people. Paired up when couples cook together, which requires it.
    participants: ['ana', 'bob', 'carmen', 'dani'].map((id, i, all) => ({
      id,
      displayName: id,
      ...(couples ? { partnerId: all[i % 2 === 0 ? i + 1 : i - 1] } : {}),
    })),
  };
}

async function signInFreshHost(request: APIRequestContext, email: string): Promise<void> {
  await hostInvitedBy(email, PASSWORD);
  await request.post('/auth/login', { data: { email, password: PASSWORD } });
}

async function seedDraft(
  request: APIRequestContext,
  name: string,
  options?: Parameters<typeof content>[1],
): Promise<string> {
  const created = await request.post('/drafts', { data: content(name, options) });
  return (await created.json()).id as string;
}

async function seedLive(
  request: APIRequestContext,
  name: string,
  options?: Parameters<typeof content>[1],
): Promise<{ id: string; joinCode: string }> {
  const draftId = await seedDraft(request, name, options);
  const published = await request.post(`/drafts/${draftId}/publish`);
  const body = await published.json();
  return { id: body.id as string, joinCode: body.joinCode as string };
}

/**
 * A participant claims their place and enters their dish, through their own API
 * context — never the host's, so the voter's cookie cannot land in the host's
 * browser session. Returns that context so they can go on to vote; every dish has
 * to exist before anybody can score, so claiming and voting are separate steps.
 */
async function claimsAndCooks(
  joinCode: string,
  contestId: string,
  id: string,
): Promise<APIRequestContext> {
  const voter = await playwrightRequest.newContext({ baseURL: API });
  await voter.post(`/contests/${joinCode}/claim`, { data: { participantId: id } });
  await voter.post(`/contests/${contestId}/dishes`, { data: { name: `${id} dish` } });
  return voter;
}

/** Scores every dish in the contest and sends — which is what makes a vote count as sent. */
async function sendsVote(
  voter: APIRequestContext,
  contestId: string,
  dishIds: readonly string[],
): Promise<void> {
  for (const dishId of dishIds) {
    const scored = await voter.post(`/contests/${contestId}/scores`, {
      data: { dishId, categoryId: 'taste', value: 4 },
    });
    // A voter may not score their own dish, which is a refusal to expect rather
    // than a failure. Anything else means the fixture is wrong, and a silently
    // unsent vote would make this test pass for the wrong reason.
    expect(
      scored.ok() || scored.status() === 403,
      `scoring ${dishId}: ${scored.status()} ${await scored.text()}`,
    ).toBeTruthy();
  }
  const sent = await voter.post(`/contests/${contestId}/send-vote`);
  expect(sent.ok(), `sending: ${sent.status()} ${await sent.text()}`).toBeTruthy();
}

/** Every dish entered so far, as the voter sees them — keyed by `dishId`, not `id`. */
async function dishesIn(voter: APIRequestContext, contestId: string): Promise<string[]> {
  const listed = await voter.get(`/contests/${contestId}/dishes`);
  expect(listed.ok(), `reading dishes: ${listed.status()}`).toBeTruthy();
  const { dishes } = (await listed.json()) as { dishes: { dishId: string }[] };
  return dishes.map((dish) => dish.dishId);
}

const rowFor = (page: Page, name: string) =>
  page.getByRole('table', { name: 'Your contests' }).getByRole('row').filter({ hasText: name });

test('a live contest shows how far along its voting is', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-progress-votes@sobremesa.es');
  const { id, joinCode } = await seedLive(page.request, 'Halfway There');

  // All four claim a place and enter a dish, so there is a full set to score.
  const voters = [];
  for (const who of ['ana', 'bob', 'carmen', 'dani']) {
    voters.push(await claimsAndCooks(joinCode, id, who));
  }
  try {
    // Two of the four go on to send; the other two claimed and stopped.
    const dishes = await dishesIn(voters[0]!, id);
    expect(dishes).toHaveLength(4); // the fixture really did produce four dishes
    await sendsVote(voters[0]!, id, dishes);
    await sendsVote(voters[1]!, id, dishes);

    await page.goto('/');
    // Stated in words, not only as a bar.
    await expect(rowFor(page, 'Halfway There')).toContainText('2 of 4 votes sent');
  } finally {
    for (const voter of voters) await voter.dispose();
  }
});

test('a contest whose voting has closed still shows what was sent', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-progress-closed@sobremesa.es');
  const { id, joinCode } = await seedLive(page.request, 'Shut And Counted');
  // All four enter a dish: a vote cannot be completed until every dish the
  // contest expects exists, so a partial roster could never send at all.
  const voters = [];
  for (const who of ['ana', 'bob', 'carmen', 'dani']) {
    voters.push(await claimsAndCooks(joinCode, id, who));
  }
  try {
    await sendsVote(voters[0]!, id, await dishesIn(voters[0]!, id));
    await page.request.post(`/contests/${id}/close`);

    await page.goto('/');
    // Closing does not erase what was sent; the host can still see how it ended.
    await expect(rowFor(page, 'Shut And Counted')).toContainText('1 of 4 votes sent');
  } finally {
    for (const voter of voters) await voter.dispose();
  }
});

test('a live contest shows what it is judged on, and the code people join it with', async ({
  page,
}) => {
  await signInFreshHost(page.request, 'e2e-progress-rules@sobremesa.es');
  const { joinCode } = await seedLive(page.request, 'Rules On Show', { categories: 3 });

  await page.goto('/');
  const row = rowFor(page, 'Rules On Show');
  await expect(row).toContainText('Everyone on their own');
  await expect(row).toContainText('3 categories');
  await expect(row).toContainText(`code ${joinCode}`);
});

test('a live contest nobody has joined says so, rather than showing an empty bar', async ({
  page,
}) => {
  await signInFreshHost(page.request, 'e2e-progress-nobody@sobremesa.es');
  await seedLive(page.request, 'Nobody Yet');

  await page.goto('/');
  const row = rowFor(page, 'Nobody Yet');
  await expect(row).toContainText('Nobody has joined yet');
  await expect(row).not.toContainText('votes sent');
});

test('a contest being prepared has no code and no votes', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-progress-draft@sobremesa.es');
  await seedDraft(page.request, 'Still Preparing');

  await page.goto('/');
  const row = rowFor(page, 'Still Preparing');
  await expect(row).toContainText('Not published');
  await expect(row).not.toContainText('code ');
  // The distinction the whole read exists for: not published is not the same
  // statement as nobody having voted, and only one of them is true here.
  await expect(row).not.toContainText('votes sent');
  await expect(row).not.toContainText('Nobody has joined yet');
});

test('a contest being prepared still shows the rules it has been given', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-progress-draft-rules@sobremesa.es');
  await seedDraft(page.request, 'Prepared Rules', { format: 'couples', categories: 2 });

  await page.goto('/');
  const row = rowFor(page, 'Prepared Rules');
  await expect(row).toContainText('Couples cook together');
  await expect(row).toContainText('2 categories');
});

test('a revealed contest says its results are out', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-progress-revealed@sobremesa.es');
  const { id } = await seedLive(page.request, 'All Out');
  await page.request.post(`/contests/${id}/close`);
  await page.request.post(`/contests/${id}/reveal`);

  await page.goto('/');
  await expect(rowFor(page, 'All Out')).toContainText('Results public');
});

test('one host learns nothing about another host’s contests', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-progress-other@sobremesa.es');
  const theirs = await seedLive(page.request, 'Theirs Alone');

  // Signing in as the second host replaces the cookie, so the browser is now them.
  await signInFreshHost(page.request, 'e2e-progress-mine@sobremesa.es');
  await seedLive(page.request, 'Mine Alone');

  await page.goto('/');
  const table = page.getByRole('table', { name: 'Your contests' });
  await expect(table.getByRole('row').filter({ hasText: 'Mine Alone' })).toBeVisible();
  await expect(table.getByRole('row').filter({ hasText: 'Theirs Alone' })).toHaveCount(0);
  await expect(table).not.toContainText(theirs.joinCode);
});

test('the whole list arrives in one request, however many contests there are', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-progress-one-ask@sobremesa.es');
  for (let i = 0; i < 6; i += 1) await seedLive(page.request, `Counted ${i}`);

  // Watch only what the page asks for, once the seeding is done.
  const reads: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') return;
    const { pathname } = new URL(request.url());
    // The list itself, and any per-contest progress read that would betray N+1.
    if (pathname === '/contests' || /^\/contests\/[^/]+\/tally$/.test(pathname)) {
      reads.push(pathname);
    }
  });

  await page.goto('/');
  await expect(rowFor(page, 'Counted 0')).toBeVisible();
  await expect(rowFor(page, 'Counted 5')).toBeVisible();

  // Nothing per contest: a tally read here would be the N+1 this read exists to
  // avoid, and six contests would mean six of them.
  expect(reads.filter((path) => path !== '/contests')).toEqual([]);
  // The list itself is read a constant number of times, not once per contest.
  // Two rather than one because React's StrictMode mounts effects twice in
  // development, which is what these tests run against; the number that matters
  // is that it does not grow with the six contests.
  expect(reads.length).toBeLessThanOrEqual(2);
});

test('the list with progress on it is still accessible', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-progress-a11y@sobremesa.es');
  await seedLive(page.request, 'Live One', { categories: 2 });
  await seedDraft(page.request, 'Draft One');
  const { id } = await seedLive(page.request, 'Done One');
  await page.request.post(`/contests/${id}/close`);
  await page.request.post(`/contests/${id}/reveal`);

  await page.goto('/');
  await expect(page.getByRole('table', { name: 'Your contests' })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('progress reads in Spanish', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-progress-spanish@sobremesa.es');
  await seedLive(page.request, 'En Español', { categories: 2 });

  await page.goto('/');
  await page.getByLabel('Language').selectOption('es');

  // The table's own accessible name is something a screen-reader user hears, so
  // it is translated too — which means it is not what identifies the table here.
  const row = page
    .getByRole('table', { name: 'Tus concursos' })
    .getByRole('row')
    .filter({ hasText: 'En Español' });
  await expect(row).toContainText('Cada cual por su cuenta');
  await expect(row).toContainText('2 categorías');
  await expect(row).toContainText('Nadie se ha unido todavía');
});
