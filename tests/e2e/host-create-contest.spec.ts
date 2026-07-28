import { test, expect, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Implements tests/e2e/host-create-contest.feature against a real API + the host
 * app in a real browser. Each test uses its own host and signs in through
 * `page.request` (which shares the browser's session cookie), so `page.goto`
 * lands already signed in.
 */
const PASSWORD = 'Str0ng!Passw0rd';

async function signInFreshHost(request: APIRequestContext, email: string): Promise<void> {
  await request.post('/auth/register', { data: { email, password: PASSWORD } });
  await request.post('/auth/login', { data: { email, password: PASSWORD } });
}

test('a host fills in a new contest and saves it as a draft', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-create@sobremesa.es');
  await page.goto('/new');

  await page.getByLabel('Contest name').fill('Summer Tapas');
  await page.getByLabel('Each couple is scored together').check();
  await page.getByLabel('Couples cannot score each other').check();

  await page.getByLabel('New participant name').fill('Ana');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('New participant name').fill('Bruno');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await page.getByRole('button', { name: 'Save as draft' }).click();

  // Lands back on the contest list, with the new contest shown as a draft.
  await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();
  const row = page.getByRole('listitem').filter({ hasText: 'Summer Tapas' });
  await expect(row).toContainText('Draft');
});

test('a contest cannot be saved without a name', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-create-noname@sobremesa.es');
  await page.goto('/new');

  await page.getByRole('button', { name: 'Save as draft' }).click();

  await expect(page.getByRole('alert')).toContainText(/name is required/i);
  await expect(page.getByRole('heading', { name: 'New contest' })).toBeVisible();
});

test('a host can leave without creating a contest', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-create-cancel@sobremesa.es');
  await page.goto('/new');

  await page.getByLabel('Contest name').fill('Abandoned Tapas');
  await page.getByRole('link', { name: 'Cancel' }).click();

  await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();
  await expect(page.getByText(/don’t have any contests yet/i)).toBeVisible();
});

test('the new-contest form is keyboard-operable and has no accessibility violations', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-create-a11y@sobremesa.es');
  await page.goto('/new');
  await expect(page.getByRole('heading', { name: 'New contest' })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);

  // Name and submit reached and operated by keyboard alone.
  await page.getByLabel('Contest name').focus();
  await page.keyboard.type('Keyboard Tapas');
  await page.getByRole('button', { name: 'Save as draft' }).focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Keyboard Tapas' })).toContainText('Draft');
});
