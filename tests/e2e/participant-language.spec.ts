import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/participant-language.feature against the participant app
 * in a real browser. The join screen needs no account, so most scenarios run
 * there; "remembered while they play" and "data is left alone" need a real live
 * contest, so those seed one through the API first.
 *
 * Participant specs use absolute URLs — the shared baseURL points at the host app.
 */
const API = 'http://localhost:3100';
const PARTICIPANT = 'http://localhost:5174';
const PASSWORD = 'Str0ng!Passw0rd';

/** A live contest with Spanish-written dishes, leaving Bruno's place open. */
async function seedContest(email: string, dishes: readonly string[]) {
  const host: APIRequestContext = await playwrightRequest.newContext({ baseURL: API });
  await hostInvitedBy(email, PASSWORD);
  await host.post('/auth/login', { data: { email, password: PASSWORD } });
  const created = await host.post('/drafts', {
    data: {
      name: 'Concurso de Tapas',
      format: 'solo',
      scoring: {
        categories: [{ id: 'c1', name: 'Sabor' }],
        range: { type: 'fixed', min: 1, max: 5 },
        uniquePerCategory: false,
      },
      closeRule: { when: 'host_trigger' },
      participants: [
        { id: 'a', displayName: 'Ana' },
        { id: 'b', displayName: 'Bruno' },
        { id: 'c', displayName: 'Carmen' },
      ],
    },
  });
  const published = await host.post(`/drafts/${(await created.json()).id}/publish`);
  const body = await published.json();
  for (const [pid, dish] of [
    ['a', dishes[0]],
    ['c', dishes[1]],
  ] as const) {
    const cook: APIRequestContext = await playwrightRequest.newContext({ baseURL: API });
    await cook.post(`/contests/${body.joinCode}/claim`, { data: { participantId: pid } });
    await cook.post(`/contests/${body.id}/dishes`, { data: { name: dish } });
  }
  return { joinCode: body.joinCode as string };
}

test.describe('a first visit follows the browser', () => {
  test.describe('when the phone is set to Spanish', () => {
    test.use({ locale: 'es-ES' });
    test('the join screen opens in Spanish', async ({ page }) => {
      await page.goto(PARTICIPANT);
      await expect(page.getByRole('heading', { name: 'Únete al concurso' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    });
  });

  test.describe('when the phone is set to a language the app does not offer', () => {
    test.use({ locale: 'fr-FR' });
    test('the join screen falls back to English', async ({ page }) => {
      await page.goto(PARTICIPANT);
      await expect(page.getByRole('heading', { name: 'Join the contest' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
  });
});

test.describe('choosing and remembering a language', () => {
  test.use({ locale: 'en-US' });

  test('choosing Español switches the whole screen at once', async ({ page }) => {
    await page.goto(PARTICIPANT);
    await expect(page.getByRole('heading', { name: 'Join the contest' })).toBeVisible();

    await page.getByRole('radio', { name: 'Español' }).check();

    // Same page instance — no reload happened, the screen simply re-rendered.
    await expect(page.getByRole('heading', { name: 'Únete al concurso' })).toBeVisible();
    await expect(page.getByText('Introduce el código que te dio el anfitrión.')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });

  test('the choice is remembered as they take their place and reload', async ({ page }) => {
    const { joinCode } = await seedContest('e2e-lang-remember@sobremesa.es', [
      'Patatas bravas',
      'Gazpacho',
    ]);

    await page.goto(PARTICIPANT);
    await page.getByRole('radio', { name: 'Español' }).check();
    await expect(page.getByRole('heading', { name: 'Únete al concurso' })).toBeVisible();

    // Take a place: the next screen must be Spanish too.
    await page.goto(`${PARTICIPANT}/j/${joinCode}`);
    await expect(page.getByRole('heading', { name: '¿Quién eres?' })).toBeVisible();
    await page.getByRole('button', { name: 'Bruno' }).click();
    await expect(page.getByRole('heading', { name: /^Tu plato, Bruno$/ })).toBeVisible();

    // …and still Spanish after a reload.
    await page.reload();
    await expect(page.getByRole('heading', { name: /^Tu plato, Bruno$/ })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });

  test('what people wrote is left in their own words', async ({ page }) => {
    const { joinCode } = await seedContest('e2e-lang-data@sobremesa.es', [
      'Patatas bravas',
      'Tortilla de la abuela',
    ]);

    // Interface in English, dishes written in Spanish.
    await page.goto(`${PARTICIPANT}/j/${joinCode}`);
    await page.getByRole('button', { name: 'Bruno' }).click();
    await expect(page.getByRole('heading', { name: /^Your dish, Bruno$/ })).toBeVisible();

    // The cooks' own words are untouched by the interface language.
    await expect(page.getByText('Patatas bravas')).toBeVisible();
    await expect(page.getByText('Tortilla de la abuela')).toBeVisible();
  });
});

test.describe('the selector is usable by everyone', () => {
  test.use({ locale: 'en-US' });

  test('it is labelled and the screen has no accessibility violations', async ({ page }) => {
    await page.goto(PARTICIPANT);
    await expect(page.getByRole('heading', { name: 'Join the contest' })).toBeVisible();

    /*
     * Named in words, not by a resource key — the defect this guards against is
     * i18next echoing a missing key, which would announce "common.language.label".
     * The control is a segmented radio group now rather than a <select>, so the
     * naming lives on each option and on the group that holds them.
     */
    await expect(page.getByRole('group', { name: 'Language' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'English' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Español' })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
