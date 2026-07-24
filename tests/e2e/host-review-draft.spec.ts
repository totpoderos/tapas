import { test, expect, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Implements tests/e2e/host-review-draft.feature against a real API + the host
 * app in a real browser. Each test uses its own host and seeds a draft through
 * `page.request` (which shares the browser's session cookie), then drives the
 * review screen the way a host would.
 */
const PASSWORD = 'Str0ng!Passw0rd';

/** A complete, publishable draft: 4 people in 2 couples, per person, couples barred. */
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

/** Seeds a draft with the given content and returns its id. */
async function seedDraft(request: APIRequestContext, content: object): Promise<string> {
  const created = await request.post('/drafts', { data: content });
  return (await created.json()).id as string;
}

test('a host reviews the rules they set on a draft', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-review@sobremesa.es');
  await seedDraft(page.request, completeContent('Summer Tapas'));

  await page.goto('/');
  await page.getByRole('link', { name: 'Summer Tapas' }).click();

  await expect(page.getByRole('heading', { name: /Review .Summer Tapas./ })).toBeVisible();
  await expect(page.getByText('Each person is scored on their own')).toBeVisible();
  await expect(page.getByText('Couples cannot score each other')).toBeVisible();
});

test('a host publishes a complete draft and it goes live', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-review-publish@sobremesa.es');
  const id = await seedDraft(page.request, completeContent('Balcony Cook-off'));

  await page.goto(`/review/${id}`);
  await page.getByRole('button', { name: /Publish/ }).click();

  await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();
  const row = page.getByRole('listitem').filter({ hasText: 'Balcony Cook-off' });
  await expect(row).toContainText('Live');
});

test('an incomplete draft cannot be taken live', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-review-incomplete@sobremesa.es');
  const id = await seedDraft(page.request, { name: 'Half-baked' }); // no scoring rules

  await page.goto(`/review/${id}`);
  await page.getByRole('button', { name: /Publish/ }).click();

  await expect(page.getByRole('alert')).toContainText(/can.t go live yet/i);
  await expect(page.getByRole('heading', { name: /Review .Half-baked./ })).toBeVisible();
});

test('a host renames a draft while reviewing it', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-review-rename@sobremesa.es');
  const id = await seedDraft(page.request, completeContent('Summer Tapas'));

  await page.goto(`/review/${id}`);
  const nameField = page.getByLabel('Contest name');
  await nameField.fill('Summer Tapas Final');
  await page.getByRole('button', { name: 'Rename' }).click();

  await page.getByRole('link', { name: 'Back to contests' }).click();
  await expect(page.getByRole('link', { name: 'Summer Tapas Final' })).toBeVisible();
});

test('the review screen is keyboard-operable and has no accessibility violations', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-review-a11y@sobremesa.es');
  const id = await seedDraft(page.request, completeContent('Rooftop Rounds'));

  await page.goto(`/review/${id}`);
  await expect(page.getByRole('heading', { name: /Review/ })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole('button', { name: /Publish/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Rooftop Rounds' })).toContainText('Live');
});
