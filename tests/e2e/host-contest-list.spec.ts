import { test, expect, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/host-contest-list.feature against a real API + the host
 * app in a real browser. Each test uses its own host so contests never leak
 * between tests, and seeds state through `page.request`, which shares the
 * browser's session cookie — so `page.goto('/')` then lands already signed in.
 */
const PASSWORD = 'Str0ng!Passw0rd';

/** A complete, publishable draft: 4 people in 2 couples, per person, couples barred. */
function completeContent(name: string) {
  const person = (id: string, partnerId: string) => ({ id, displayName: id, partnerId });
  return {
    name,
    format: 'solo_with_partners',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: true },
    participants: [person('A', 'B'), person('B', 'A'), person('C', 'D'), person('D', 'C')],
  };
}

/** Registers and signs in a fresh host, leaving the session cookie in the browser context. */
async function signInFreshHost(request: APIRequestContext, email: string): Promise<void> {
  await hostInvitedBy(email, PASSWORD);
  await request.post('/auth/login', { data: { email, password: PASSWORD } });
}

/** Saves a draft; leaves it a contest still being prepared. */
async function seedDraft(request: APIRequestContext, name: string): Promise<void> {
  await request.post('/drafts', { data: completeContent(name) });
}

/** Saves and publishes a draft, returning the live contest id. */
async function seedLive(request: APIRequestContext, name: string): Promise<string> {
  const created = await request.post('/drafts', { data: completeContent(name) });
  const draftId = (await created.json()).id as string;
  await request.post(`/drafts/${draftId}/publish`);
  return draftId;
}

/** Saves, publishes, closes, and reveals a contest. */
async function seedRevealed(request: APIRequestContext, name: string): Promise<void> {
  const id = await seedLive(request, name);
  await request.post(`/contests/${id}/close`);
  await request.post(`/contests/${id}/reveal`);
}

test('a host sees their contests with a clear status on each', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-list-mixed@sobremesa.es');
  await seedDraft(page.request, 'Summer Tapas');
  await seedLive(page.request, 'Balcony Cook-off');
  await seedRevealed(page.request, 'Winter Feast');

  await page.goto('/');
  // A table now, not a list: rows of related fields under column headings, so
  // assistive technology can say which column a cell belongs to. The header row
  // is one of the rows, hence four.
  const list = page.getByRole('table', { name: 'Your contests' });
  await expect(list.getByRole('row')).toHaveCount(4);

  const rowFor = (name: string) => list.getByRole('row').filter({ hasText: name });
  await expect(rowFor('Summer Tapas')).toContainText('Draft');
  await expect(rowFor('Balcony Cook-off')).toContainText('Live');
  await expect(rowFor('Winter Feast')).toContainText('Revealed');
});

test('a host with no contests is invited to create their first', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-list-empty@sobremesa.es');

  await page.goto('/');
  await expect(page.getByText(/don’t have any contests yet/i)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create your first contest' })).toBeVisible();
});

test('a host can start a new contest from the list', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-list-new@sobremesa.es');
  await seedLive(page.request, 'Rooftop Rounds');

  await page.goto('/');
  const newContest = page.getByRole('link', { name: 'New contest' });
  await expect(newContest).toBeVisible();

  await newContest.click();
  await expect(page.getByRole('heading', { name: 'New contest' })).toBeVisible();
});

test('the contest list is keyboard-operable and has no accessibility violations', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-list-a11y@sobremesa.es');
  await seedDraft(page.request, 'Summer Tapas');
  await seedLive(page.request, 'Balcony Cook-off');
  await seedRevealed(page.request, 'Winter Feast');

  await page.goto('/');
  await expect(page.getByRole('table', { name: 'Your contests' })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);

  // The control to start a new contest can be reached and operated by keyboard.
  const newContest = page.getByRole('link', { name: 'New contest' });
  await newContest.focus();
  await expect(newContest).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'New contest' })).toBeVisible();
});
