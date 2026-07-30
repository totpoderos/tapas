import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/host-draft-review.feature against a real API + the host app
 * in a real browser.
 *
 * The scenarios the older host-review-draft.spec.ts already covers — editing rules,
 * publishing a complete draft, refusing an incomplete one — stay there. This file is
 * about pairing, barring and what the screen says is still missing.
 */
const PASSWORD = 'Str0ng!Passw0rd';

const panel = (page: Page, named = 'Panel navigation') =>
  page.getByRole('navigation', { name: named });

/** A draft with `people` participants, none paired, scored the given way. */
function content(name: string, attribution: 'per_person' | 'per_couple', people = 2) {
  return {
    name,
    attribution,
    antiBias: 'arbitrary_pairs',
    scoring: {
      categories: [{ id: 'taste', name: 'Taste' }],
      range: { type: 'fixed', min: 1, max: 5 },
      uniquePerCategory: false,
    },
    participants: ['Ana', 'Bruno', 'Carmen', 'Dani']
      .slice(0, people)
      .map((displayName, i) => ({ id: `p${i + 1}`, displayName })),
  };
}

async function hostWithDraft(
  page: Page,
  email: string,
  attribution: 'per_person' | 'per_couple' = 'per_couple',
  people = 2,
): Promise<string> {
  await hostInvitedBy(email, PASSWORD);
  await page.request.post('/auth/login', { data: { email, password: PASSWORD } });
  const created = await page.request.post('/drafts', {
    data: content('Barrio Supper Club', attribution, people),
  });
  return (await created.json()).id as string;
}

/** The draft as stored, read back so an assertion is about what was saved. */
async function storedDraft(request: APIRequestContext, id: string) {
  const read = await request.get(`/drafts/${id}`);
  return (await read.json()) as {
    content: { participants?: { id: string; partnerId?: string; noScoreWith?: string[] }[] };
  };
}

test('the screen says what is still missing, and the panel says it too', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-missing@sobremesa.es');

  await page.goto(`/review/${id}`);
  const checklist = page.getByRole('region', { name: 'Publish checklist' });
  await expect(checklist).toContainText('Name set');
  await expect(checklist).toContainText('1 scoring category');
  await expect(checklist).toContainText('2 participants without a partner');
  // Where a host sees it without scrolling the surface.
  await expect(panel(page)).toContainText('Before publishing');
  await expect(panel(page)).toContainText('2 participants without a partner');
});

test('a participant without a partner is marked where they are', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-marked@sobremesa.es');

  await page.goto(`/review/${id}`);
  await expect(page.getByText('needs a partner')).toHaveCount(2);

  await page.getByLabel('Partner of Ana').selectOption({ label: 'Bruno' });
  await expect(page.getByText('needs a partner')).toHaveCount(0);
});

test('pairing is only asked about when scoring is per couple', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-perperson@sobremesa.es', 'per_person');

  await page.goto(`/review/${id}`);
  await expect(page.getByRole('region', { name: 'Publish checklist' })).toContainText('Name set');
  // Nobody is short of anything: pairing is beside the point here.
  await expect(page.getByText('needs a partner')).toHaveCount(0);
  await expect(panel(page)).not.toContainText('Before publishing');
});

test('pairing two people is reciprocal and clears what was missing', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-pairing@sobremesa.es');

  await page.goto(`/review/${id}`);
  await page.getByLabel('Partner of Ana').selectOption({ label: 'Bruno' });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();

  const { content: saved } = await storedDraft(page.request, id);
  const ana = saved.participants?.find((p) => p.id === 'p1');
  const bruno = saved.participants?.find((p) => p.id === 'p2');
  expect(ana?.partnerId).toBe('p2');
  expect(bruno?.partnerId).toBe('p1');

  await expect(page.getByRole('region', { name: 'Publish checklist' })).toContainText(
    'Everything needed is in place',
  );
});

test('barring a pair bars it both ways', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-barring@sobremesa.es');

  await page.goto(`/review/${id}`);
  await page.getByLabel('One').selectOption({ label: 'Ana' });
  await page.getByLabel('The other').selectOption({ label: 'Bruno' });
  await page.getByRole('button', { name: 'Bar this pair' }).click();

  // Listed once, as a pair rather than twice as two people.
  const pairs = page.getByRole('list', { name: 'Can’t score each other' });
  await expect(pairs.getByRole('listitem')).toHaveCount(1);

  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();

  // The option is called "chosen pairs cannot score each other", so it must be both.
  const { content: saved } = await storedDraft(page.request, id);
  expect(saved.participants?.find((p) => p.id === 'p1')?.noScoreWith).toEqual(['p2']);
  expect(saved.participants?.find((p) => p.id === 'p2')?.noScoreWith).toEqual(['p1']);
});

test('lifting a bar lifts it both ways', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-lifting@sobremesa.es');

  await page.goto(`/review/${id}`);
  await page.getByLabel('One').selectOption({ label: 'Ana' });
  await page.getByLabel('The other').selectOption({ label: 'Bruno' });
  await page.getByRole('button', { name: 'Bar this pair' }).click();
  await page.getByRole('button', { name: 'Let Ana and Bruno score each other again' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();

  const { content: saved } = await storedDraft(page.request, id);
  expect(saved.participants?.find((p) => p.id === 'p1')?.noScoreWith ?? []).toEqual([]);
  expect(saved.participants?.find((p) => p.id === 'p2')?.noScoreWith ?? []).toEqual([]);
});

test('saving and publishing are in the panel’s header', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-header@sobremesa.es');

  await page.goto(`/review/${id}`);
  const save = page.getByRole('button', { name: 'Save changes' });
  await expect(save).toBeVisible();
  await expect(page.getByRole('button', { name: /Publish/ })).toBeVisible();
  // Outside the form in the DOM, reaching it by name.
  expect(await save.evaluate((b) => b.closest('form') === null)).toBe(true);

  await expect(panel(page)).toContainText('Barrio Supper Club');
  await expect(panel(page)).toContainText('Draft');
});

test('publishing a ready draft lands in its control room, where the join code is', async ({
  page,
}) => {
  // Four people in two couples: enough that the couples rule leaves work for everyone.
  const id = await hostWithDraft(page, 'e2e-review-publish@sobremesa.es', 'per_couple', 4);

  await page.goto(`/review/${id}`);
  await page.getByLabel('Partner of Ana').selectOption({ label: 'Bruno' });
  await page.getByLabel('Partner of Carmen').selectOption({ label: 'Dani' });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();

  await page.getByRole('button', { name: /Publish/ }).click();

  await expect(page.getByRole('region', { name: 'Progress' })).toBeVisible();
  await expect(page.getByText('Join code')).toBeVisible();
  await expect(panel(page)).toContainText('Live');
});

test('publishing a draft the server refuses says why, and leaves it a draft', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-incomplete@sobremesa.es');

  await page.goto(`/review/${id}`);
  // One couple and nobody else: each of them may only score their own couple's
  // dish, so the compiler refuses it. The checklist cannot see that — it reads the
  // draft, not the rules engine — which is the point: the checklist predicts, the
  // server decides, and when they disagree the server wins and the host is told.
  await page.getByLabel('Partner of Ana').selectOption({ label: 'Bruno' });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Publish checklist' })).toContainText(
    'Everything needed is in place',
  );

  await page.getByRole('button', { name: /Publish/ }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  // Still a draft: the panel still says so.
  await expect(panel(page)).toContainText('Draft');
});

test('the screen is keyboard-operable and free of accessibility violations', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-a11y@sobremesa.es', 'per_couple', 4);

  await page.goto(`/review/${id}`);
  await expect(page.getByRole('region', { name: 'Publish checklist' })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);

  const save = page.getByRole('button', { name: 'Save changes' });
  await save.focus();
  await expect(save).toBeFocused();
});

test('the screen reads in Spanish, leaving names alone', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-spanish@sobremesa.es');

  await page.goto(`/review/${id}`);
  await page.getByLabel('Language').selectOption('es');

  await expect(page.getByRole('region', { name: 'Lista para publicar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
  // What the host wrote is left in their own words. Asked for by its Spanish label,
  // because the labels are translated too — the names inside them are not.
  await expect(page.getByLabel('Nombre del participante 1')).toHaveValue('Ana');
  await expect(page.getByLabel('Nombre del concurso')).toHaveValue('Barrio Supper Club');
});

test('the screen holds together on a narrow screen', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-narrow@sobremesa.es');

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/review/${id}`);
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
