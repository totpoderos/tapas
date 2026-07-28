import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Implements tests/e2e/host-language.feature against the host app in a real
 * browser. The language selector rides along on every screen; the sign-in
 * screen needs no account, so we exercise it there. Browser-preference scenarios
 * pin the context locale; the switch-and-remember scenarios start from English.
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

    // Navigate to sign-up (its link is now in Spanish), then reload.
    await page.getByRole('link', { name: 'Crea una cuenta de anfitrión' }).click();
    await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();
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
