import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Implements tests/e2e/host-language.feature against the host app in a real
 * browser. The language selector rides along on every screen; the sign-in
 * screen needs no account, so we exercise it there. Browser-preference scenarios
 * pin the context locale; the switch-and-remember scenarios start from English.
 *
 * NOT YET IMPLEMENTED HERE — three scenarios of that feature concern a refusal
 * to publish read in the chosen language: on the rules form, with its categories
 * still named as the host wrote them, and the same refusal from the assistant.
 * They need a signed-in host and a contest built to be refused, which is more
 * setup than the scenarios above and is why they are called out rather than
 * quietly missing. What holds them today: nine component tests over
 * `refusalText`, an exhaustiveness test that every refusal has words in both
 * languages, and a by-hand pass through both surfaces in Spanish. Writing them
 * here is worth doing — a `.feature` scenario with nothing running it reads as
 * coverage and is not.
 */

test.describe('a first visit follows the browser', () => {
  test.describe('when the browser prefers Spanish', () => {
    test.use({ locale: 'es-ES' });
    test('the app opens in Spanish', async ({ page }) => {
      await page.goto('/sign-in');
      await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    });
  });

  test.describe('when the browser prefers an unsupported language', () => {
    test.use({ locale: 'fr-FR' });
    test('the app falls back to English', async ({ page }) => {
      await page.goto('/sign-in');
      await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
  });
});

test.describe('choosing and remembering a language', () => {
  test.use({ locale: 'en-US' });

  test('choosing Español switches the whole screen at once', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    await page.getByLabel('Language').selectOption('es');

    await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });

  test('the chosen language survives navigation and a reload', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Language').selectOption('es');
    await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible();

    // Navigate to the other anonymous screen, then reload. This used to go
    // through the sign-up link; sign-up went with open registration, and the
    // claim screen is what is left that anybody can reach without an account.
    await page.goto('/claim');
    await expect(
      page.getByRole('heading', { name: 'Esta instalación ya tiene administrador' }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Esta instalación ya tiene administrador' }),
    ).toBeVisible();
  });

  test('the language selector is labelled and the screen is accessible', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByLabel('Language')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
