import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/host-activity-log-panel.feature against a real API + the
 * host app in a real browser.
 *
 * One scenario of that feature is not here: "a contest nothing has happened to".
 * Every contest starts life as a saved draft, so the API cannot produce an empty
 * log and there is nothing real to drive. That state is covered where it can be —
 * the unit test, which can hand the screen an empty log.
 */
const PASSWORD = 'Str0ng!Passw0rd';

const panel = (page: Page, named = 'Panel navigation') =>
  page.getByRole('navigation', { name: named });

const log = (page: Page, named = 'Activity') => page.getByRole('table', { name: named });

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

/**
 * A contest with a history of mixed sources: saved in-app, published by the
 * system, then closed with the host's confirmation — which is what the panel
 * sends when a host confirms the dialog.
 */
async function contestWithHistory(request: APIRequestContext, name: string): Promise<string> {
  const created = await request.post('/drafts', { data: completeContent(name) });
  expect(created.ok()).toBe(true);
  const id = (await created.json()).id as string;
  const published = await request.post(`/drafts/${id}/publish`);
  expect(published.ok()).toBe(true);
  const closed = await request.post(`/contests/${id}/close`, {
    headers: { 'x-tapas-confirmation': 'host' },
  });
  expect(closed.ok()).toBe(true);
  return id;
}

test('every recorded action is a row saying what, who, when and how it was triggered', async ({
  page,
}) => {
  await signInFreshHost(page.request, 'e2e-log-rows@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto(`/log/${id}`);
  const table = log(page);
  for (const column of ['Event', 'Source', 'Actor', 'When']) {
    await expect(table.getByRole('columnheader', { name: column })).toBeVisible();
  }

  const published = table.getByRole('row').filter({ hasText: 'Contest published' });
  await expect(published).toHaveCount(1);
  // Who and how are different questions: the host published it, and the system is
  // what carried the action out. A row that collapsed them would be less useful.
  await expect(published).toContainText('System');
  await expect(published).toContainText('you');
  // Every row says when, to the minute: two actions a minute apart are a
  // different story from two an hour apart.
  await expect(published).toContainText(/\d\d:\d\d/);
});

test('how an action was triggered is said in words, not by colour alone', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-log-words@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto(`/log/${id}`);
  const table = log(page);
  await expect(table.getByRole('row').filter({ hasText: 'Draft saved' })).toContainText('In-app');
  await expect(table.getByRole('row').filter({ hasText: 'Contest published' })).toContainText(
    'System',
  );
});

test('a host narrows the log to one source and widens it again', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-log-narrow@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto(`/log/${id}`);
  await expect(log(page).getByText('Draft saved')).toBeVisible();

  await page.getByRole('radio', { name: /System/ }).check();

  await expect(log(page).getByText('Contest published')).toBeVisible();
  await expect(log(page).getByText('Draft saved')).toHaveCount(0);

  await page.getByRole('radio', { name: 'All sources' }).check();

  await expect(log(page).getByText('Draft saved')).toBeVisible();
});

test('narrowing to a source with nothing in it says so, and not that there is no history', async ({
  page,
}) => {
  await signInFreshHost(page.request, 'e2e-log-emptysource@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto(`/log/${id}`);
  // Nothing here came through an assistant.
  await page.getByRole('radio', { name: /Connected tool/ }).check();

  await expect(page.getByText(/nothing from this source yet/i)).toBeVisible();
  await expect(page.getByText(/does have a history/i)).toBeVisible();
  await expect(page.getByText(/nothing has happened to this contest/i)).toHaveCount(0);
  // And it is a state the host can get back out of.
  await expect(page.getByRole('radio', { name: 'All sources' })).toBeVisible();
});

test('an action the host confirmed says so, and the others do not', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-log-confirmed@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto(`/log/${id}`);
  const table = log(page);
  await expect(table.getByRole('row').filter({ hasText: 'Contest closed' })).toContainText(
    'You confirmed',
  );
  await expect(table.getByRole('row').filter({ hasText: 'Draft saved' })).not.toContainText(
    'You confirmed',
  );
});

test('the log is not another host’s to read', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-log-owner@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Someone Else’s Feast');

  // A different host entirely, signed in over the top of the first.
  await signInFreshHost(page.request, 'e2e-log-stranger@sobremesa.es');
  await page.goto(`/log/${id}`);

  await expect(page.getByText(/isn’t yours to view/i)).toBeVisible();
  await expect(page.getByText('Someone Else’s Feast')).toHaveCount(0);
  await expect(log(page)).toHaveCount(0);
});

test('the panel says which contest’s log this is, and offers the way back', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-log-panel@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto(`/log/${id}`);
  await expect(panel(page)).toContainText('Balcony Cook-off');
  await expect(panel(page).getByRole('link', { name: 'Activity log' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await panel(page).getByRole('link', { name: 'Control room' }).click();
  await expect(page).toHaveURL(new RegExp(`/contest/${id}$`));
});

test('the log is keyboard-operable and free of accessibility violations', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-log-a11y@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto(`/log/${id}`);
  await expect(log(page)).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);

  // Narrowed and widened without a mouse: focus the group, then move within it
  // with the arrow keys the way a radio group is meant to be driven.
  const all = page.getByRole('radio', { name: 'All sources' });
  await all.focus();
  await expect(all).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(log(page).getByText('Draft saved')).toBeVisible();
  await expect(log(page).getByText('Contest published')).toHaveCount(0);
  await page.keyboard.press('ArrowLeft');
  await expect(log(page).getByText('Contest published')).toBeVisible();
});

test('the log is free of accessibility violations in the dark theme too', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-log-dark@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto(`/log/${id}`);
  await page.getByRole('button', { name: /dark theme/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  /*
   * Every other axe run in this suite is in the light theme, which is how a
   * 1.29:1 "You confirmed" badge reached this screen: the token pairing that
   * reads at 14.47:1 on a pale plate was near-invisible on a dark one.
   */
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('the log reads in Spanish, leaving the contest’s name alone', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-log-spanish@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.goto(`/log/${id}`);
  await page.getByLabel('Language').selectOption('es');

  await expect(page.getByRole('heading', { name: 'Registro de actividad' })).toBeVisible();
  const table = log(page, 'Actividad');
  await expect(table.getByRole('columnheader', { name: 'Origen' })).toBeVisible();
  await expect(table.getByText('Concurso publicado')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Todos los orígenes' })).toBeVisible();
  // What the host called their contest is left in their own words.
  await expect(panel(page, 'Navegación del panel')).toContainText('Balcony Cook-off');
});

test('the log holds together on a narrow screen', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-log-narrow-screen@sobremesa.es');
  const id = await contestWithHistory(page.request, 'Balcony Cook-off');

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/log/${id}`);
  await expect(log(page)).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);

  // The chips wrap onto two rows here; wrapping must not leave one unreachable.
  for (const name of [/System/, /In-app/, 'All sources'] as const) {
    await page.getByRole('radio', { name }).check();
    await expect(page.getByRole('radio', { name })).toBeChecked();
  }

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('an action the assistant took is told apart from the host’s own', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-log-provenance@sobremesa.es');
  // Live, not already closed: the assistant needs something left to do.
  const created = await page.request.post('/drafts', { data: completeContent('Balcony Cook-off') });
  const id = (await created.json()).id as string;
  expect((await page.request.post(`/drafts/${id}/publish`)).ok()).toBe(true);

  /*
   * The whole loop, in a browser: the host asks the assistant to do something,
   * the assistant dispatches it back through the API, and the log says it came
   * through a connected tool. Before provenance was carried across that
   * dispatch this filter could never match a row — which no unit test noticed,
   * because each half worked on its own.
   */
  await page.goto('/chat');
  await page.getByLabel('Message the assistant').fill(`close contest ${id}`);
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByRole('button', { name: 'Yes, do it' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);

  await page.goto(`/log/${id}`);
  await page.getByRole('radio', { name: /Connected tool/ }).check();

  const closed = log(page).getByRole('row').filter({ hasText: 'Contest closed' });
  await expect(closed).toHaveCount(1);
  await expect(closed).toContainText('Connected tool');
  // Still the host's action, and still one they confirmed.
  await expect(closed).toContainText('you');
  await expect(closed).toContainText('You confirmed');

  // And what the host did in the app is not swept in with it.
  await expect(log(page).getByText('Draft saved')).toHaveCount(0);
  await page.getByRole('radio', { name: /In-app/ }).check();
  await expect(log(page).getByText('Draft saved')).toBeVisible();
  await expect(log(page).getByText('Contest closed')).toHaveCount(0);
});
