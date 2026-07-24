import { test, expect, request as playwrightRequest } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Implements tests/e2e/host-authentication.feature against a real API + the host
 * app in a real browser. A host account is seeded once through the same
 * same-origin proxy the browser uses.
 */
const HOST = { email: 'e2e-host@sobremesa.es', password: 'Str0ng!Passw0rd' };

test.beforeAll(async ({ baseURL }) => {
  const api = await playwrightRequest.newContext({ baseURL });
  await api.post('/auth/register', { data: HOST });
  await api.dispose();
});

test('a new host creates an account and lands signed in', async ({ page }) => {
  await page.goto('/sign-up');
  await page.getByLabel('Email').fill('brand-new@sobremesa.es');
  await page.getByLabel('Password').fill('An0ther!Str0ngPass');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();
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

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);

  // Fill and submit using only the keyboard.
  await page.getByLabel('Email').focus();
  await page.keyboard.type(HOST.email);
  await page.keyboard.press('Tab');
  await page.keyboard.type(HOST.password);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();
});
