import { test, expect, request as playwrightRequest } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/host-authentication.feature against a real API + the host
 * app in a real browser. A host account is seeded once through the same
 * same-origin proxy the browser uses.
 */
const HOST = { email: 'e2e-host@sobremesa.es', password: 'Str0ng!Passw0rd' };

test.beforeAll(async ({ baseURL }) => {
  const api = await playwrightRequest.newContext({ baseURL });
  await hostInvitedBy(HOST.email, HOST.password);
  await api.dispose();
});

test('the sign-up address leads nowhere', async ({ page }) => {
  // Somebody will have it bookmarked. Nothing creates an account for itself any
  // more; the only ways in are an invitation and claiming the deployment.
  await page.goto('/sign-up');

  await expect(page.getByRole('button', { name: 'Create account' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('a returning host signs in and lands on home', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(HOST.email);
  await page.getByLabel('Password').fill(HOST.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();
});

test('the wrong password is refused with an announced error', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(HOST.email);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText(/don’t match/i);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('a signed-in host is remembered across a reload', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(HOST.email);
  await page.getByLabel('Password').fill(HOST.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();
});

test('a signed-in host can sign out', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(HOST.email);
  await page.getByLabel('Password').fill(HOST.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('the sign-in screen is keyboard-operable and has no accessibility violations', async ({ page }) => {
  await page.goto('/sign-in');

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);

  // Fill and submit using only the keyboard.
  await page.getByLabel('Email').focus();
  await page.keyboard.type(HOST.email);
  await page.keyboard.press('Tab');
  await page.keyboard.type(HOST.password);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();
});
