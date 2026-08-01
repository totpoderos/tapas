import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/host-rule-space.feature against a real API + the host app in
 * a real browser.
 *
 * The scenarios the older host-create-contest.spec.ts already covers — filling the
 * form in and saving, refusing without a name, leaving without creating — are left
 * there rather than duplicated. This file is about what setting a contest up looks
 * like on the panel.
 */
const PASSWORD = 'Str0ng!Passw0rd';

const panel = (page: Page, named = 'Panel navigation') =>
  page.getByRole('navigation', { name: named });

async function signInFreshHost(page: Page, email: string): Promise<void> {
  await hostInvitedBy(email, PASSWORD);
  await page.request.post('/auth/login', { data: { email, password: PASSWORD } });
}

test('the panel says where setting up sits in getting a contest going', async ({ page }) => {
  await signInFreshHost(page, 'e2e-rules-steps@sobremesa.es');

  await page.goto('/new');
  const nav = panel(page);
  // The two sections a contest is prepared in, under their own names — the same
  // two it carries once saved, so a host meets one pair of names throughout.
  await expect(nav).toContainText('Rules');
  await expect(nav).toContainText('Participants & pairing');
  // The people are drawn but cannot be reached: there is nobody to add to a
  // contest that has not been saved yet.
  await expect(nav).toContainText('— after saving');
  await expect(nav.getByRole('link', { name: /Participants/ })).toHaveCount(0);
});

test('the panel says only a name is required to save', async ({ page }) => {
  await signInFreshHost(page, 'e2e-rules-cheap@sobremesa.es');

  await page.goto('/new');
  await expect(panel(page)).toContainText('Only a name is required to save');
  await expect(panel(page)).toContainText('checked when you publish');
});

test('saving and cancelling live in the panel’s header', async ({ page }) => {
  await signInFreshHost(page, 'e2e-rules-header@sobremesa.es');

  await page.goto('/new');
  const save = page.getByRole('button', { name: 'Save as draft' });
  await expect(save).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cancel' })).toBeVisible();
  // Outside the form in the DOM, reaching it by name — so it must still submit.
  expect(await save.evaluate((b) => b.closest('form') === null)).toBe(true);

  await page.getByLabel('Contest name').fill('Headered Feast');
  await save.click();
  await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Your contests' }).getByText('Headered Feast'),
  ).toBeVisible();
});

test('starting another contest is not offered while already setting one up', async ({ page }) => {
  await signInFreshHost(page, 'e2e-rules-nonew@sobremesa.es');

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'New contest' })).toBeVisible();

  await page.goto('/new');
  // The surface's own Save and Cancel are what matter here.
  await expect(page.getByRole('link', { name: 'New contest' })).toHaveCount(0);
});

test('a host adds and removes what dishes are judged on', async ({ page }) => {
  await signInFreshHost(page, 'e2e-rules-categories@sobremesa.es');

  await page.goto('/new');
  const categories = page.getByRole('list', { name: 'Scoring categories' });
  await expect(categories).toContainText('Taste');

  await page.getByLabel('New category name').fill('Presentation');
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(categories).toContainText('Presentation');

  await page.getByRole('button', { name: 'Remove category Taste' }).click();
  await expect(categories).not.toContainText('Taste');
  await expect(categories).toContainText('Presentation');
});

test('the ends of the band are asked for only once one is being fixed', async ({ page }) => {
  await signInFreshHost(page, 'e2e-rules-band@sobremesa.es');

  await page.goto('/new');
  await expect(page.getByLabel('Lowest score')).toHaveCount(0);

  await page.getByLabel('Fixed range').click();
  await expect(page.getByLabel('Lowest score')).toBeVisible();
  await expect(page.getByLabel('Highest score')).toBeVisible();
});

test('the rules chosen are what gets saved', async ({ page }) => {
  await signInFreshHost(page, 'e2e-rules-saved@sobremesa.es');

  await page.goto('/new');
  await page.getByLabel('Contest name').fill('Chosen Rules');
  await page.getByLabel('Each couple is scored together').click();
  await page.getByLabel('Couples cannot score each other').click();
  await page.getByLabel('Fixed range').click();
  await page.getByLabel('Lowest score').fill('1');
  await page.getByLabel('Highest score').fill('5');
  await page.getByRole('button', { name: 'Save as draft' }).click();

  await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();

  // Read back through the API, so this asserts what was stored rather than what the
  // screen happened to show.
  const listed = await page.request.get('/contests');
  const contests = (await listed.json()) as { name: string; attribution?: string }[];
  const saved = contests.find((c) => c.name === 'Chosen Rules');
  expect(saved?.attribution).toBe('per_couple');
});

test('the choices are real radios and the rule a real checkbox', async ({ page }) => {
  await signInFreshHost(page, 'e2e-rules-semantics@sobremesa.es');

  await page.goto('/new');
  // Drawn as cards, but a screen reader and the keyboard still get radios in a
  // group — the looks are the label's business, the semantics the input's.
  await expect(page.getByRole('radio', { name: 'Each person is scored on their own' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Each couple is scored together' })).not.toBeChecked();
  await expect(page.getByRole('checkbox')).toBeChecked();

  await page.getByLabel('Each couple is scored together').press('Space');
  await expect(page.getByRole('radio', { name: 'Each couple is scored together' })).toBeChecked();
});

test('the rule space is keyboard-operable and free of accessibility violations', async ({
  page,
}) => {
  await signInFreshHost(page, 'e2e-rules-a11y@sobremesa.es');

  await page.goto('/new');
  await page.getByLabel('Fixed range').click();
  await expect(page.getByLabel('Lowest score')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);

  const save = page.getByRole('button', { name: 'Save as draft' });
  await save.focus();
  await expect(save).toBeFocused();
});

test('the rule space reads in Spanish', async ({ page }) => {
  await signInFreshHost(page, 'e2e-rules-spanish@sobremesa.es');

  await page.goto('/new');
  await page.getByLabel('Language').selectOption('es');

  await expect(panel(page, 'Navegación del panel')).toContainText('Reglas');
  await expect(panel(page, 'Navegación del panel')).toContainText('Participantes y parejas');
  await expect(panel(page, 'Navegación del panel')).toContainText('Solo hace falta un nombre');
  await expect(page.getByRole('button', { name: 'Guardar como borrador' })).toBeVisible();
});

test('the rule space holds together on a narrow screen', async ({ page }) => {
  await signInFreshHost(page, 'e2e-rules-narrow@sobremesa.es');

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/new');
  await expect(page.getByLabel('Contest name')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save as draft' })).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
