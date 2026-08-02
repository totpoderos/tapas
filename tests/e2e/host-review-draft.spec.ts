import { test, expect, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

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
    format: 'solo_with_partners',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: true },
    participants: [person('A', 'B'), person('B', 'A'), person('C', 'D'), person('D', 'C')],
  };
}

async function signInFreshHost(request: APIRequestContext, email: string): Promise<void> {
  await hostInvitedBy(email, PASSWORD);
  await request.post('/auth/login', { data: { email, password: PASSWORD } });
}

/** Seeds a draft with the given content and returns its id. */
async function seedDraft(request: APIRequestContext, content: object): Promise<string> {
  const created = await request.post('/drafts', { data: content });
  return (await created.json()).id as string;
}

test('a host opens a draft to edit its rules', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-review@sobremesa.es');
  await seedDraft(page.request, completeContent('Summer Tapas'));

  await page.goto('/');
  await page.getByRole('link', { name: 'Summer Tapas' }).click();

  await expect(page.getByRole('heading', { name: /Edit .Summer Tapas./ })).toBeVisible();
  // The rules the host chose are loaded into the editable form.
  await expect(
    page.getByRole('radio', { name: 'Everyone on their own, partners kept apart' }),
  ).toBeChecked();
});

test('a host publishes a complete draft and it goes live', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-review-publish@sobremesa.es');
  const id = await seedDraft(page.request, completeContent('Balcony Cook-off'));

  await page.goto(`/review/${id}`);
  await page.getByRole('button', { name: /Publish/ }).click();

  // Publishing lands in the control room now, where the join code is — the very
  // next thing a host needs, rather than another click away on the list.
  await expect(page.getByRole('region', { name: 'Progress' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Panel navigation' }).getByText('Live'),
  ).toBeVisible();
});

test('an incomplete draft cannot be taken live', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-review-incomplete@sobremesa.es');
  const id = await seedDraft(page.request, { name: 'Half-baked' }); // no scoring rules

  await page.goto(`/review/${id}`);
  await page.getByRole('button', { name: /Publish/ }).click();

  await expect(page.getByRole('alert')).toContainText(/can.t go live yet/i);
  await expect(page.getByRole('heading', { name: /Edit .Half-baked./ })).toBeVisible();
});

test("a host edits a draft's rules and the change persists", async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-review-edit@sobremesa.es');
  const id = await seedDraft(page.request, completeContent('Summer Tapas'));

  // The name is on the rules and the roster is on the participants, and one save
  // stores both — which is why this still reads as one edit.
  await page.goto(`/review/${id}`);
  await page.getByLabel('Contest name').fill('Summer Tapas Final');
  await page
    .getByRole('navigation', { name: 'Panel navigation' })
    .getByRole('link', { name: 'Participants & pairing', exact: true })
    .click();
  await page.getByRole('button', { name: 'Remove A' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();

  // Reopen the draft — the edits were persisted.
  await page.goto(`/review/${id}/people`);
  await expect(page.getByRole('heading', { name: /Edit .Summer Tapas Final./ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Participant \d+ name/ })).toHaveCount(3); // was 4
});

test('the review screen is keyboard-operable and has no accessibility violations', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-review-a11y@sobremesa.es');
  const id = await seedDraft(page.request, completeContent('Rooftop Rounds'));

  await page.goto(`/review/${id}`);
  await expect(page.getByRole('heading', { name: /Edit/ })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole('button', { name: /Publish/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Progress' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Panel navigation' }).getByText('Live'),
  ).toBeVisible();
});
