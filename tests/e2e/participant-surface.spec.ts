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
 * Implements tests/e2e/participant-surface.feature.
 *
 * The participant app has its own visual language now, in one light appearance,
 * and two screens whose whole job is to say there is nothing left to do. These
 * check the parts of that which are not visible in a screenshot: that the two
 * apps really are drawn from different definitions, that a dark-preferring
 * phone still gets the light screen, and that a dead end offers exactly one way
 * out.
 */
const API = 'http://localhost:3100';
const HOST_WEB = 'http://localhost:5173';
const PARTICIPANT = 'http://localhost:5174';
const PASSWORD = 'Str0ng!Passw0rd';

/**
 * The colour an app leads with — its accent, resolved from whatever the running
 * page actually computes rather than read out of a stylesheet. Reading the token
 * is the point: if the two apps ever share a sheet again, this is what changes.
 */
async function accentOf(page: Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--brand').trim(),
  );
}

function content(name: string) {
  return {
    name,
    format: 'solo',
    closeRule: { when: 'host_trigger' },
    scoring: {
      categories: [{ id: 'taste', name: 'Taste' }],
      range: { type: 'fixed', min: 1, max: 5 },
      uniquePerCategory: false,
    },
    participants: [
      { id: 'ana', displayName: 'Ana' },
      { id: 'bob', displayName: 'Bob' },
    ],
  };
}

async function publish(email: string): Promise<{ contestId: string; joinCode: string; host: APIRequestContext }> {
  const host: APIRequestContext = await playwrightRequest.newContext({ baseURL: API });
  await hostInvitedBy(email, PASSWORD);
  await host.post('/auth/login', { data: { email, password: PASSWORD } });
  const created = await host.post('/drafts', { data: content('Balcony Cook-off') });
  const published = await host.post(`/drafts/${(await created.json()).id}/publish`);
  const body = await published.json();
  return { contestId: body.id as string, joinCode: body.joinCode as string, host };
}

test('the two apps do not look alike', async ({ page, browser }) => {
  await page.goto(`${HOST_WEB}/sign-in`);
  const host = await accentOf(page);

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(PARTICIPANT);
  const participant = await accentOf(guestPage);

  expect(host).not.toEqual('');
  expect(participant).not.toEqual('');
  expect(participant).not.toEqual(host);
  await guest.close();
});

test('a phone set to a dark appearance still gets the light one', async ({ browser }) => {
  const dark = await browser.newContext({ colorScheme: 'dark' });
  const page = await dark.newPage();
  await page.goto(PARTICIPANT);

  /*
   * The check is on what is painted, not on an attribute. Pinning is done by
   * this app's stylesheet having no dark block at all, so there is no
   * `data-theme` to assert — and asserting one would pass just as well on an app
   * that set the attribute and then ignored it.
   */
  const ground = await page.evaluate(
    () => getComputedStyle(document.documentElement).getPropertyValue('--ground').trim(),
  );
  expect(ground.toLowerCase()).toBe('#f6f2ec');

  // `color-scheme` is what keeps the phone from painting native controls dark.
  const scheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme,
  );
  expect(scheme).toBe('light');
  await dark.close();
});

test('nothing offers to change the appearance', async ({ page }) => {
  await page.goto(PARTICIPANT);
  await expect(page.getByRole('button', { name: /theme/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /dark|oscuro/i })).toHaveCount(0);
});

test('the header is on every screen', async ({ page }) => {
  const { joinCode } = await publish('e2e-surface-header@sobremesa.es');

  await page.goto(PARTICIPANT);
  await expect(page.getByRole('banner').getByText('Tapas')).toBeVisible();

  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Ana' }).click();
  await expect(page.getByRole('heading', { name: /your dish, ana/i })).toBeVisible();
  await expect(page.getByRole('banner').getByText('Tapas')).toBeVisible();

  await page.goto(`${PARTICIPANT}/score`);
  await expect(page.getByRole('banner').getByText('Tapas')).toBeVisible();

  /*
   * The WAIT, not the reveal — the results are not out yet. The revealed
   * results are the one screen with no header, and they are checked where they
   * can be seeded properly, in `participant-reveal.spec.ts`.
   */
  await page.goto(`${PARTICIPANT}/reveal`);
  await expect(page.getByText(/almost there/i)).toBeVisible();
  await expect(page.getByRole('banner').getByText('Tapas')).toBeVisible();
});

test('a contest that is gone says so, and offers the way out', async ({ page }) => {
  const { contestId, joinCode, host } = await publish('e2e-surface-gone@sobremesa.es');

  await page.goto(`${PARTICIPANT}/j/${joinCode}`);
  await page.getByRole('button', { name: 'Ana' }).click();
  await expect(page.getByRole('heading', { name: /your dish, ana/i })).toBeVisible();

  /*
   * Deleting needs the contest's name typed back once somebody has joined — the
   * API's own escalation, and Ana has just claimed her place. Asserting the
   * status matters: without it a refused delete leaves the contest alive and the
   * failure surfaces further down as a missing heading, which reads as a bug in
   * the screen rather than in the setup.
   */
  const deleted = await host.delete(
    `/contests/${contestId}?confirm=${encodeURIComponent('Balcony Cook-off')}`,
  );
  expect(deleted.status()).toBe(204);

  await page.goto(`${PARTICIPANT}/score`);

  await expect(page.getByRole('heading', { name: /this contest is gone/i })).toBeVisible();
  await expect(page.getByText(/nothing you did was wrong/i)).toBeVisible();

  // The only thing on the screen that goes anywhere.
  const links = page.getByRole('main').getByRole('link');
  await expect(links).toHaveCount(1);
  await expect(links).toHaveText(/join another contest/i);
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
});

test('a lost session says so, and offers the way back', async ({ page }) => {
  // No claim was ever made in this browser, so /score is not recognised.
  await page.goto(`${PARTICIPANT}/score`);

  await expect(page.getByRole('heading', { name: /join first/i })).toBeVisible();
  await expect(page.getByText(/still there/i)).toBeVisible();

  const links = page.getByRole('main').getByRole('link');
  await expect(links).toHaveCount(1);
  await expect(links).toHaveText(/go to join/i);
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
});

test('the plain screens are readable on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto(`${PARTICIPANT}/score`);
  await expect(page.getByRole('heading', { name: /join first/i })).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);

  // The way out is still there, and still big enough to hit.
  const out = page.getByRole('main').getByRole('link');
  await expect(out).toBeVisible();
  const box = await out.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test('the plain screens have no accessibility violations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${PARTICIPANT}/score`);
  await expect(page.getByRole('heading', { name: /join first/i })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
