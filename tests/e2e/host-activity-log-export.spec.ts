import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/host-activity-log-export.feature against a real API + the
 * host app in a real browser, downloading the file the way a host would and
 * reading back what actually arrived.
 *
 * The escaping rules themselves are unit-tested at the field level, where every
 * case can be stated; what belongs here is that a real download carries a real
 * log, and that a refusal is told without taking the screen away.
 */
const PASSWORD = 'Str0ng!Passw0rd';

const panel = (page: Page, named = 'Panel navigation') =>
  page.getByRole('navigation', { name: named });

function completeContent(name: string) {
  const person = (id: string, partnerId: string) => ({ id, displayName: id, partnerId });
  return {
    name,
    format: 'solo_with_partners',
    scoring: {
      categories: [{ id: 'c1', name: 'Taste' }],
      range: { type: 'auto' },
      uniquePerCategory: true,
    },
    participants: [person('A', 'B'), person('B', 'A'), person('C', 'D'), person('D', 'C')],
  };
}

async function signInFreshHost(request: APIRequestContext, email: string): Promise<void> {
  await hostInvitedBy(email, PASSWORD);
  const signedIn = await request.post('/auth/login', { data: { email, password: PASSWORD } });
  expect(signedIn.ok()).toBe(true);
}

async function contestWithHistory(request: APIRequestContext, name: string): Promise<string> {
  const created = await request.post('/drafts', { data: completeContent(name) });
  expect(created.ok()).toBe(true);
  const id = (await created.json()).id as string;
  expect((await request.post(`/drafts/${id}/publish`)).ok()).toBe(true);
  expect(
    (
      await request.post(`/contests/${id}/close`, {
        headers: { 'x-tapas-confirmation': 'host' },
      })
    ).ok(),
  ).toBe(true);
  return id;
}

/** Clicks Export and returns what the browser actually saved. */
async function download(page: Page): Promise<{ filename: string; body: string }> {
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const saved = await waiting;
  const stream = await saved.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return { filename: saved.suggestedFilename(), body: Buffer.concat(chunks).toString('utf8') };
}

test('a host takes the log away from the screen they were reading it on', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-export-take@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto(`/log/${id}`);
  await expect(page.getByRole('table', { name: 'Activity' })).toBeVisible();

  const { filename, body } = await download(page);

  expect(filename).toBe('Balcony-Cook-off-activity-log.csv');
  expect(body.split('\r\n')[0]).toBe('event,source,actor,confirmed,when,details');
  expect(body).toContain('contest.published');
  expect(body).toContain('contest.closed');
});

test('the file says what the screen says', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-export-same@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto(`/log/${id}`);
  const table = page.getByRole('table', { name: 'Activity' });
  await expect(table).toBeVisible();
  const rowsOnScreen = await table.getByRole('row').count();
  expect(rowsOnScreen).toBeGreaterThan(1);

  const { body } = await download(page);
  const rows = body.trimEnd().split('\r\n').slice(1);

  // Same count — the table's rows include its heading row, as this file's do not.
  expect(rows).toHaveLength(rowsOnScreen - 1);
});

test('the file records what the host confirmed', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-export-confirmed@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto(`/log/${id}`);
  const { body } = await download(page);

  const closed = body.split('\r\n').find((row) => row.startsWith('contest.closed'));
  expect(closed?.split(',')[3]).toBe('host');
  // And an action nobody was asked about is not dressed up as one they approved.
  const saved = body.split('\r\n').find((row) => row.startsWith('draft.saved'));
  expect(saved?.split(',')[3]).toBe('');
});

test('the log of a contest that is not the host’s is not theirs to take', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-export-owner@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Someone Else’s Feast');

  await signInFreshHost(page.request, 'e2e-export-stranger@sobremesa.es');
  const refused = await page.request.get(`/contests/${id}/audit?format=csv`);

  expect(refused.status()).toBe(403);
  expect(refused.headers()['content-type']).not.toContain('text/csv');
  expect(await refused.text()).not.toContain('contest.published');
});

test('a refusal is told on the screen, not by replacing it', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-export-refusal@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto(`/log/${id}`);
  await expect(page.getByRole('table', { name: 'Activity' })).toBeVisible();

  // The contest goes out from under the host — deleted in another session, as
  // it might be by an assistant — so the next export is genuinely refused.
  await page.route(`**/contests/${id}/audit?format=csv`, (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'NOT_ALLOWED', message: 'Not allowed.' } }),
    }),
  );
  await page.getByRole('button', { name: 'Export CSV' }).click();

  await expect(page.getByRole('alert')).toContainText(/couldn’t be prepared/i);
  // Still reading the log they were reading.
  await expect(page.getByRole('table', { name: 'Activity' })).toBeVisible();
  await expect(panel(page)).toContainText('Balcony Cook-off');
});

test('taking the log away is keyboard-operable and free of accessibility violations', async ({
  page,
}) => {
  await signInFreshHost(page.request, 'e2e-export-a11y@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto(`/log/${id}`);
  const take = page.getByRole('button', { name: 'Export CSV' });
  await expect(take).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);

  const waiting = page.waitForEvent('download');
  await take.focus();
  await expect(take).toBeFocused();
  await page.keyboard.press('Enter');
  expect((await waiting).suggestedFilename()).toContain('activity-log.csv');
});

test('the way to take the log away reads in Spanish', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-export-spanish@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto(`/log/${id}`);
  await page.getByLabel('Language').selectOption('es');

  await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeVisible();
});
