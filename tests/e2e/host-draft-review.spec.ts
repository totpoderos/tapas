import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/host-draft-review.feature against a real API + the host app
 * in a real browser.
 *
 * The scenarios the older host-review-draft.spec.ts already covers — editing rules,
 * publishing a complete draft, refusing an incomplete one — stay there. This file is
 * about the two sections a contest is prepared in, pairing, barring and what is said
 * to be still missing.
 */
const PASSWORD = 'Str0ng!Passw0rd';

const panel = (page: Page, named = 'Panel navigation') =>
  page.getByRole('navigation', { name: named });

/** The two ways in the panel draws under a contest being prepared. */
const wayTo = (page: Page, section: 'Rules' | 'Participants & pairing') =>
  panel(page).getByRole('link', { name: section, exact: true });

const goToSection = (page: Page, section: 'Rules' | 'Participants & pairing') =>
  wayTo(page, section).click();

/** A draft with `people` participants, none paired, in the given format. */
function content(name: string, format: ContestFormat, people = 2) {
  return {
    name,
    format,
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

type ContestFormat = 'solo' | 'solo_with_partners' | 'couples';

async function hostWithDraft(
  page: Page,
  email: string,
  format: ContestFormat = 'couples',
  people = 2,
): Promise<string> {
  await hostInvitedBy(email, PASSWORD);
  await page.request.post('/auth/login', { data: { email, password: PASSWORD } });
  const created = await page.request.post('/drafts', {
    data: content('Barrio Supper Club', format, people),
  });
  return (await created.json()).id as string;
}

/** The draft as stored, read back so an assertion is about what was saved. */
async function storedDraft(request: APIRequestContext, id: string) {
  const read = await request.get(`/drafts/${id}`);
  return (await read.json()) as {
    content: {
      name: string;
      participants?: { id: string; displayName: string; partnerId?: string }[];
    };
  };
}

/* ── The two sections ───────────────────────────────────────────────────────── */

test('a contest being prepared is settled in two sections', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-two@sobremesa.es');

  await page.goto(`/review/${id}`);
  await expect(wayTo(page, 'Rules')).toBeVisible();
  await expect(wayTo(page, 'Participants & pairing')).toBeVisible();
  await expect(panel(page)).toContainText('Barrio Supper Club');
  await expect(panel(page)).toContainText('not published');

  // The rules: what it is called and how it is judged, and nothing about who.
  await expect(page.getByLabel('Contest name')).toHaveValue('Barrio Supper Club');
  await expect(page.getByRole('radio', { name: 'Couples cook together' })).toBeChecked();
  await expect(page.getByLabel('Participant 1 name')).toHaveCount(0);

  await goToSection(page, 'Participants & pairing');

  // The people: who is taking part and who may not score whom, and nothing else.
  await expect(page.getByLabel('Participant 1 name')).toHaveValue('Ana');
  await expect(page.getByRole('button', { name: 'Bar this pair' })).toBeVisible();
  await expect(page.getByLabel('Contest name')).toHaveCount(0);
});

test('the panel says which section the host is on', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-current@sobremesa.es');

  await page.goto(`/review/${id}`);
  await expect(wayTo(page, 'Rules')).toHaveAttribute('aria-current', 'page');
  await expect(wayTo(page, 'Participants & pairing')).not.toHaveAttribute('aria-current', 'page');

  await goToSection(page, 'Participants & pairing');
  await expect(wayTo(page, 'Participants & pairing')).toHaveAttribute('aria-current', 'page');
  await expect(wayTo(page, 'Rules')).not.toHaveAttribute('aria-current', 'page');
});

test('an unsaved change survives moving between the sections', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-carries@sobremesa.es');

  await page.goto(`/review/${id}`);
  await page.getByLabel('Contest name').fill('Barrio Supper Club — Final');
  await goToSection(page, 'Participants & pairing');
  await expect(page.getByLabel('Participant 1 name')).toBeVisible();
  await goToSection(page, 'Rules');

  await expect(page.getByLabel('Contest name')).toHaveValue('Barrio Supper Club — Final');

  // And moving is not saving: the stored contest is untouched until asked.
  const { content: stored } = await storedDraft(page.request, id);
  expect(stored.name).toBe('Barrio Supper Club');
});

test('one save stores a change made on each section', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-onesave@sobremesa.es');

  await page.goto(`/review/${id}`);
  await page.getByLabel('Contest name').fill('Barrio Supper Club — Final');
  await goToSection(page, 'Participants & pairing');
  await page.getByLabel('New participant name').fill('Carmen');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();

  const { content: stored } = await storedDraft(page.request, id);
  expect(stored.name).toBe('Barrio Supper Club — Final');
  expect(stored.participants?.map((p) => p.displayName)).toEqual(['Ana', 'Bruno', 'Carmen']);
});

/* ── What is still missing ──────────────────────────────────────────────────── */

test('what is still missing is said on both sections, and in the panel', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-missing@sobremesa.es');

  await page.goto(`/review/${id}`);
  const checklist = page.getByRole('region', { name: 'Publish checklist' });
  await expect(checklist).toContainText('Name set');
  await expect(checklist).toContainText('1 scoring category');
  await expect(checklist).toContainText('2 participants without a partner');
  // Where a host sees it without scrolling the surface.
  await expect(panel(page)).toContainText('Before publishing');
  await expect(panel(page)).toContainText('2 participants without a partner');

  // The checklist is about the whole contest, so it rides along to the other section.
  await goToSection(page, 'Participants & pairing');
  await expect(checklist).toContainText('2 participants without a partner');
  await expect(panel(page)).toContainText('Before publishing');
});

test('the checklist counts the people, and does not call an empty contest ready', async ({
  page,
}) => {
  // Nobody at all, and one person alone, are both certain refusals — the one
  // person gets one dish and may not score their own. The checklist used to say
  // nothing about people, so an empty contest read "Everything needed is in place"
  // and was then refused by the server.
  const id = await hostWithDraft(page, 'e2e-review-count@sobremesa.es', 'solo', 2);
  const checklist = page.getByRole('region', { name: 'Publish checklist' });

  await page.goto(`/review/${id}/people`);
  await expect(checklist).toContainText('2 people taking part');

  await page.getByRole('button', { name: 'Remove Bruno' }).click();
  await expect(checklist).toContainText('at least two are needed');
  await expect(checklist).toContainText('nobody may score their own dish');
  await expect(checklist).not.toContainText('Everything needed is in place');

  await page.getByRole('button', { name: 'Remove Ana' }).click();
  await expect(checklist).toContainText('Nobody is taking part yet');
  await expect(checklist).not.toContainText('Everything needed is in place');
});

test('a contest just started does not claim to be ready', async ({ page }) => {
  // The form that starts a contest hands the host to an empty roster, which is
  // where a green checklist would be seen first and be most misleading.
  await hostInvitedBy('e2e-review-fresh@sobremesa.es', PASSWORD);
  await page.request.post('/auth/login', {
    data: { email: 'e2e-review-fresh@sobremesa.es', password: PASSWORD },
  });

  await page.goto('/new');
  await page.getByLabel('Contest name').fill('Fresh Start');
  await page.getByRole('button', { name: /^Next/ }).click();

  await expect(page.getByLabel('New participant name')).toBeVisible();
  const checklist = page.getByRole('region', { name: 'Publish checklist' });
  await expect(checklist).toContainText('Nobody is taking part yet');
  await expect(checklist).not.toContainText('Everything needed is in place');
});

test('a participant without a partner is marked where they are', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-marked@sobremesa.es');

  await page.goto(`/review/${id}/people`);
  await expect(page.getByText('needs a partner')).toHaveCount(2);

  await page.getByLabel('Partner of Ana').selectOption({ label: 'Bruno' });
  await expect(page.getByText('needs a partner')).toHaveCount(0);
});

test('pairing is not asked about at all when everyone is on their own', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-solo@sobremesa.es', 'solo');

  await page.goto(`/review/${id}/people`);
  await expect(page.getByRole('region', { name: 'Publish checklist' })).toContainText('Name set');
  // A partner would do nothing under this format, so it is not offered at all.
  await expect(page.getByLabel('Partner of Ana')).toHaveCount(0);
  await expect(page.getByText('needs a partner')).toHaveCount(0);
  await expect(panel(page)).not.toContainText('Before publishing');
});

test('a partner is offered but not insisted on when partners are kept apart', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-apart@sobremesa.es', 'solo_with_partners');

  await page.goto(`/review/${id}/people`);
  await expect(page.getByLabel('Partner of Ana')).toBeVisible();
  // Having none is a choice under this format, not a fault.
  await expect(page.getByText('needs a partner')).toHaveCount(0);
  await expect(panel(page)).not.toContainText('Before publishing');
});

/* ── Pairing ────────────────────────────────────────────────────────────────── */

test('pairing two people is reciprocal and clears what was missing', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-pairing@sobremesa.es');

  await page.goto(`/review/${id}/people`);
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

test('a pairing survives a change of format', async ({ page }) => {
  // Under `solo` a partner does nothing, but it is a roster fact the format has
  // no use for rather than a rule that failed to apply. Throwing it away would
  // lose work the host did.
  const id = await hostWithDraft(page, 'e2e-review-keeps-pairing@sobremesa.es');

  await page.goto(`/review/${id}/people`);
  await page.getByLabel('Partner of Ana').selectOption({ label: 'Bruno' });

  await goToSection(page, 'Rules');
  await page.getByRole('radio', { name: 'Everyone on their own' }).check();
  await page.getByRole('radio', { name: 'Couples cook together' }).check();
  await goToSection(page, 'Participants & pairing');

  await expect(page.getByLabel('Partner of Ana')).toHaveValue('p2');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();

  const { content: saved } = await storedDraft(page.request, id);
  expect(saved.participants?.find((p) => p.id === 'p1')?.partnerId).toBe('p2');
  expect(saved.participants?.find((p) => p.id === 'p2')?.partnerId).toBe('p1');
});

test('there is nowhere to bar a pair by hand', async ({ page }) => {
  // A partner is the only way two people are kept apart now.
  const id = await hostWithDraft(page, 'e2e-review-nobarring@sobremesa.es');

  await page.goto(`/review/${id}/people`);
  await expect(page.getByRole('button', { name: 'Bar this pair' })).toHaveCount(0);
  await expect(page.getByText(/Can’t score each other/)).toHaveCount(0);
  await expect(page.getByText(/Not in force for this contest/)).toHaveCount(0);
});

/* ── Saving and publishing, from either section ─────────────────────────────── */

test('saving and publishing are in the panel’s header, on both sections', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-header@sobremesa.es');

  await page.goto(`/review/${id}`);
  const save = page.getByRole('button', { name: 'Save changes' });
  await expect(save).toBeVisible();
  await expect(page.getByRole('button', { name: /Publish/ })).toBeVisible();
  // Outside the form in the DOM, reaching it by name.
  expect(await save.evaluate((b) => b.closest('form') === null)).toBe(true);

  await expect(panel(page)).toContainText('Barrio Supper Club');
  await expect(panel(page)).toContainText('Draft');

  await goToSection(page, 'Participants & pairing');
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Publish/ })).toBeVisible();
});

test('a nameless contest says so wherever the host tries to save it', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-nameless@sobremesa.es');

  // The name is typed on the rules, so being refused on the other section has to
  // be explained there rather than beside a field the host cannot see.
  await page.goto(`/review/${id}`);
  await page.getByLabel('Contest name').fill('');
  await goToSection(page, 'Participants & pairing');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByRole('alert')).toContainText('A name is required.');
  const { content: stored } = await storedDraft(page.request, id);
  expect(stored.name).toBe('Barrio Supper Club');
});

test('publishing a ready draft lands in its control room, where the join code is', async ({
  page,
}) => {
  // Four people in two couples: enough that the couples rule leaves work for everyone.
  const id = await hostWithDraft(page, 'e2e-review-publish@sobremesa.es', 'couples', 4);

  await page.goto(`/review/${id}/people`);
  await page.getByLabel('Partner of Ana').selectOption({ label: 'Bruno' });
  await page.getByLabel('Partner of Carmen').selectOption({ label: 'Dani' });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();

  // From the rules, to show publishing is not tied to the section the work was on.
  await goToSection(page, 'Rules');
  await page.getByRole('button', { name: /Publish/ }).click();

  await expect(page.getByRole('region', { name: 'Progress' })).toBeVisible();
  await expect(page.getByText('Join code')).toBeVisible();
  await expect(panel(page)).toContainText('Live');
});

test('publishing a draft the server refuses says why, and leaves the host where they were', async ({
  page,
}) => {
  const id = await hostWithDraft(page, 'e2e-review-incomplete@sobremesa.es');

  await page.goto(`/review/${id}/people`);
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
  // Still a draft, and still on the section they were on.
  await expect(panel(page)).toContainText('Draft');
  await expect(wayTo(page, 'Participants & pairing')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByLabel('Participant 1 name')).toBeVisible();
});

/* ── Accessibility and language, on each section ────────────────────────────── */

const scan = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

test('both sections are keyboard-operable and free of accessibility violations', async ({
  page,
}) => {
  const id = await hostWithDraft(page, 'e2e-review-a11y@sobremesa.es', 'couples', 4);

  // Both, not one: splitting the screen in two halves the coverage otherwise.
  await page.goto(`/review/${id}`);
  await expect(page.getByRole('region', { name: 'Publish checklist' })).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);

  await goToSection(page, 'Participants & pairing');
  await expect(page.getByLabel('Participant 1 name')).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);

  const save = page.getByRole('button', { name: 'Save changes' });
  await save.focus();
  await expect(save).toBeFocused();
});

test('both sections read in Spanish, leaving names alone', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-spanish@sobremesa.es');

  await page.goto(`/review/${id}`);
  await page.getByLabel('Language').selectOption('es');

  await expect(page.getByRole('region', { name: 'Lista para publicar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
  // The two ways in are translated too — and so is the landmark's own name, which
  // is something a screen-reader user hears, so it is not what identifies the
  // navigation here.
  const es = panel(page, 'Navegación del panel');
  await expect(es.getByRole('link', { name: 'Reglas', exact: true })).toBeVisible();
  const people = es.getByRole('link', { name: 'Participantes y parejas', exact: true });
  await expect(people).toBeVisible();
  // What the host wrote is left in their own words. Asked for by its Spanish label,
  // because the labels are translated too — the names inside them are not.
  await expect(page.getByLabel('Nombre del concurso')).toHaveValue('Barrio Supper Club');

  await people.click();
  await expect(page.getByLabel('Nombre del participante 1')).toHaveValue('Ana');
});

test('both sections hold together on a narrow screen', async ({ page }) => {
  const id = await hostWithDraft(page, 'e2e-review-narrow@sobremesa.es');

  const noOverflow = async () => {
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
    expect((await scan(page)).violations).toEqual([]);
  };

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/review/${id}`);
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
  await noOverflow();

  await page.goto(`/review/${id}/people`);
  await expect(page.getByLabel('Participant 1 name')).toBeVisible();
  await noOverflow();
});
