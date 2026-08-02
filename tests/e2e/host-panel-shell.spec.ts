import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ADMINISTRATOR } from './support/administrator.js';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/host-panel-shell.feature against a real API + the host app
 * in a real browser.
 *
 * Each test seeds its own host so contests never leak between them, and seeds
 * through `page.request`, which shares the browser's session cookie — so
 * `page.goto('/')` then lands already signed in.
 */
const PASSWORD = 'Str0ng!Passw0rd';

/** The panel's navigation: one landmark, wherever the host is. */
const navigation = (page: Page) => page.getByRole('navigation', { name: 'Panel navigation' });

/** A complete, publishable draft: 4 people in 2 couples, per person, couples barred. */
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
  await request.post('/auth/login', { data: { email, password: PASSWORD } });
}

async function seedDraft(request: APIRequestContext, name: string): Promise<string> {
  const created = await request.post('/drafts', { data: completeContent(name) });
  return (await created.json()).id as string;
}

async function seedLive(request: APIRequestContext, name: string): Promise<string> {
  const id = await seedDraft(request, name);
  await request.post(`/drafts/${id}/publish`);
  return id;
}

async function seedRevealed(request: APIRequestContext, name: string): Promise<string> {
  const id = await seedLive(request, name);
  await request.post(`/contests/${id}/close`);
  await request.post(`/contests/${id}/reveal`);
  return id;
}

test('the navigation is present on every screen a host can reach', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-shell-everywhere@sobremesa.es');
  const live = await seedLive(page.request, 'Shell Live');
  const draft = await seedDraft(page.request, 'Shell Draft');

  for (const path of ['/', '/chat', '/new', `/contest/${live}`, `/log/${live}`, `/review/${draft}`]) {
    await page.goto(path);
    await expect(navigation(page), `navigation on ${path}`).toBeVisible();
  }
});

test('the navigation is absent when nobody is signed in', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(navigation(page)).toHaveCount(0);
});

test('a host reaches the assistant from inside a contest, without going back first', async ({
  page,
}) => {
  await signInFreshHost(page.request, 'e2e-shell-across@sobremesa.es');
  const live = await seedLive(page.request, 'Shell Across');

  await page.goto(`/log/${live}`);
  await navigation(page).getByRole('link', { name: 'Assistant' }).click();

  await expect(page.getByRole('heading', { name: 'Assistant' })).toBeVisible();
});

test('the navigation says which surface the host is on', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-shell-current@sobremesa.es');
  const live = await seedLive(page.request, 'Shell Current');

  await page.goto(`/log/${live}`);
  await expect(navigation(page).getByRole('link', { name: 'Activity log' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(navigation(page).getByRole('link', { name: 'Control room' })).not.toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('the navigation counts the host’s contests by state', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-shell-counts@sobremesa.es');
  await seedLive(page.request, 'Counted Live A');
  await seedLive(page.request, 'Counted Live B');
  await seedDraft(page.request, 'Counted Draft');
  await seedRevealed(page.request, 'Counted Revealed');

  await page.goto('/');
  const nav = navigation(page);
  await expect(nav.getByRole('link', { name: /All contests/ })).toContainText('4');
  await expect(nav.getByRole('link', { name: /^Live/ })).toContainText('2');
  await expect(nav.getByRole('link', { name: /^Drafts/ })).toContainText('1');
  await expect(nav.getByRole('link', { name: /Closed & revealed/ })).toContainText('1');
});

test('a host with no contests is counted as none, not as nothing', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-shell-none@sobremesa.es');

  await page.goto('/');
  await expect(navigation(page).getByText(/None yet/)).toBeVisible();
});

test('narrowing to one state shows only those contests', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-shell-filter@sobremesa.es');
  await seedLive(page.request, 'Filter Live');
  await seedDraft(page.request, 'Filter Draft');

  await page.goto('/');
  await navigation(page).getByRole('link', { name: /^Drafts/ }).click();

  const table = page.getByRole('table', { name: 'Your contests' });
  await expect(table.getByRole('row').filter({ hasText: 'Filter Draft' })).toBeVisible();
  await expect(table.getByRole('row').filter({ hasText: 'Filter Live' })).toHaveCount(0);
});

test('inside a contest the navigation is about that contest', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-shell-scope@sobremesa.es');
  const live = await seedLive(page.request, 'Scoped Crawl');

  await page.goto(`/contest/${live}`);
  const nav = navigation(page);
  await expect(nav.getByText('Scoped Crawl')).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Activity log' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'All contests' })).toBeVisible();
});

test('the results of a contest that has not been revealed are shown but cannot be taken', async ({
  page,
}) => {
  await signInFreshHost(page.request, 'e2e-shell-unrevealed@sobremesa.es');
  const live = await seedLive(page.request, 'Not Out Yet');

  await page.goto(`/contest/${live}`);
  const nav = navigation(page);
  await expect(nav.getByText('Not Out Yet')).toBeVisible(); // the list is in
  await expect(nav.getByText('— after reveal')).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Results' })).toHaveCount(0);
});

test('the results are offered once they are out', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-shell-revealed@sobremesa.es');
  const done = await seedRevealed(page.request, 'All Out');

  await page.goto(`/contest/${done}`);
  await navigation(page).getByRole('link', { name: 'Results' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('skipping the navigation lands on the surface, past it', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-shell-skip@sobremesa.es');
  await seedLive(page.request, 'Skipped Past');

  await page.goto('/');
  await expect(page.getByRole('table', { name: 'Your contests' })).toBeVisible();

  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');

  // The skip link targets the surface, so the address carries it and what follows
  // is the surface's own content rather than a way in from the navigation.
  await expect(page).toHaveURL(/#main$/);
});

test('the panel is keyboard-operable and has no accessibility violations', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-shell-a11y@sobremesa.es');
  await seedLive(page.request, 'A11y Live');
  await seedDraft(page.request, 'A11y Draft');

  await page.goto('/');
  await expect(page.getByRole('table', { name: 'Your contests' })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);

  // A way in can be reached and taken with the keyboard alone.
  const assistant = navigation(page).getByRole('link', { name: 'Assistant' });
  await assistant.focus();
  await expect(assistant).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Assistant' })).toBeVisible();
});

test('a contest’s state is readable by word and by shape', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-shell-shape@sobremesa.es');
  await seedLive(page.request, 'Shaped Live');
  await seedDraft(page.request, 'Shaped Draft');

  await page.goto('/');
  const table = page.getByRole('table', { name: 'Your contests' });
  // The word, and a distinct mark beside it — never the colour alone.
  await expect(table.getByRole('row').filter({ hasText: 'Shaped Live' })).toContainText('●Live');
  await expect(table.getByRole('row').filter({ hasText: 'Shaped Draft' })).toContainText('◇Draft');
});

test('the navigation reads in Spanish, and contest names do not', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-shell-spanish@sobremesa.es');
  await seedLive(page.request, 'Spring Tapas Crawl');

  await page.goto('/');
  await page.getByLabel('Language').selectOption('es');

  // The landmark's own name is something a screen-reader user hears, so it is
  // translated too — which means it is not what identifies the navigation here.
  const nav = page.getByRole('navigation', { name: 'Navegación del panel' });
  await expect(nav.getByRole('link', { name: /Todos los concursos/ })).toBeVisible();
  await expect(nav.getByRole('link', { name: /Asistente/ })).toBeVisible();
  // What the host wrote is left in their own words.
  await expect(page.getByRole('link', { name: 'Spring Tapas Crawl' })).toBeVisible();
});

test('the panel holds together on a narrow screen', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-shell-narrow@sobremesa.es');
  await seedLive(page.request, 'Narrow Live');

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  // Collapsed behind a disclosure, and opening it reveals the ways in.
  const disclosure = page.getByRole('button', { name: 'Panel navigation' });
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await disclosure.click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(navigation(page).getByRole('link', { name: /All contests/ })).toBeVisible();

  // Nothing forces the page itself sideways (WCAG 1.4.10 reflow).
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test.describe('the two kinds of work do not mix', () => {
  test('an administrator lands on the people, offered nothing of a host’s', async ({ page }) => {
    await page.request.post('/auth/login', { data: ADMINISTRATOR });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();

    const nav = navigation(page);
    await expect(nav.getByRole('link', { name: 'People & access' })).toBeVisible();
    await expect(nav.getByRole('link', { name: /All contests/ })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Assistant' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'New contest' })).toHaveCount(0);
  });

  test('an administrator asking for a host surface is taken to the people', async ({ page }) => {
    await page.request.post('/auth/login', { data: ADMINISTRATOR });

    await page.goto('/new');
    await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
  });

  test('a host is offered no way to the people, and is told plainly if they go there', async ({
    page,
  }) => {
    await signInFreshHost(page.request, 'e2e-shell-host-only@sobremesa.es');

    await page.goto('/');
    await expect(navigation(page).getByRole('link', { name: 'People & access' })).toHaveCount(0);

    // Hiding the way in is a courtesy; the refusal is what protects it.
    await page.goto('/people');
    await expect(page.getByRole('heading', { name: 'This screen is not for you' })).toBeVisible();
    await expect(navigation(page).getByRole('link', { name: /All contests/ })).toBeVisible();
  });
});
