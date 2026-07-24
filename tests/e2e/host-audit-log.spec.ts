import { test, expect, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Implements tests/e2e/host-audit-log.feature against a real API + the host app.
 * Each test seeds a contest with a mix of sources (a draft it saves = in-app,
 * then publish = system, then close), so the source filter has real data.
 */
const PASSWORD = 'Str0ng!Passw0rd';

function completeContent(name: string) {
  const person = (id: string, partnerId: string) => ({ id, displayName: id, partnerId });
  return {
    name,
    attribution: 'per_person',
    antiBias: 'couples',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: true },
    participants: [person('A', 'B'), person('B', 'A'), person('C', 'D'), person('D', 'C')],
  };
}

async function signInFreshHost(request: APIRequestContext, email: string): Promise<void> {
  await request.post('/auth/register', { data: { email, password: PASSWORD } });
  await request.post('/auth/login', { data: { email, password: PASSWORD } });
}

/** Saves a draft (in-app), publishes it (system), and closes it — a log with mixed sources. */
async function contestWithHistory(request: APIRequestContext, name: string): Promise<string> {
  const created = await request.post('/drafts', { data: completeContent(name) });
  const id = (await created.json()).id as string;
  await request.post(`/drafts/${id}/publish`);
  await request.post(`/contests/${id}/close`);
  return id;
}

test('a host opens a contest’s activity log from their list', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-audit-open@sobremesa.es');
  await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto('/');
  // A published contest opens its control room; the activity log is a link from there.
  await page.getByRole('link', { name: 'Balcony Cook-off' }).click();
  await page.getByRole('link', { name: 'Activity log' }).click();

  await expect(page.getByRole('heading', { name: 'Activity log' })).toBeVisible();
  const list = page.getByRole('list', { name: 'Activity' });
  await expect(list.getByText('Contest published')).toBeVisible();
  await expect(list.getByText('Contest closed')).toBeVisible();
});

test('a host filters the log by how actions were triggered', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-audit-filter@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto(`/log/${id}`);
  const list = page.getByRole('list', { name: 'Activity' });
  await expect(list.getByText('Contest published')).toBeVisible(); // system
  await expect(list.getByText('Draft saved')).toBeVisible(); // in-app

  await page.getByLabel('Filter by source').selectOption('system');

  await expect(list.getByText('Contest published')).toBeVisible();
  await expect(list.getByText('Draft saved')).toHaveCount(0);
});

test('the activity log is keyboard-operable and has no accessibility violations', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-audit-a11y@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto(`/log/${id}`);
  await expect(page.getByRole('list', { name: 'Activity' })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);

  // Operate the filter with the keyboard alone.
  await page.getByLabel('Filter by source').focus();
  await page.getByLabel('Filter by source').selectOption('form');
  await expect(page.getByRole('list', { name: 'Activity' }).getByText('Draft saved')).toBeVisible();
});
