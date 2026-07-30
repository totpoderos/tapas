import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ADMINISTRATOR } from './support/administrator.js';
import { clearMail } from './support/mail.js';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/host-people-panel-shell.feature against a real API + the
 * host app in a real browser.
 *
 * The scenarios the older host-people-panel.spec.ts already covers — inviting,
 * resending, revoking, and a host being refused — stay there. This file is about
 * the screen on the shell: the administrative navigation carrying nothing else,
 * and the standings as words.
 *
 * Two scenarios of the feature are **not** here: the link shown once, and its not
 * coming back. This suite runs against a real mail catcher, so an invitation is
 * always sent and the fall-back link never appears — the state exists only where
 * sending fails. They are covered in the unit test, which can make sending fail,
 * and said here rather than left as a silent gap.
 */
const HOST = { email: 'e2e-people-host@sobremesa.es', password: 'Str0ng!Passw0rd' };

const panel = (page: Page, named = 'Panel navigation') =>
  page.getByRole('navigation', { name: named });

const people = (page: Page, named = 'People in this deployment') =>
  page.getByRole('table', { name: named });

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  const landing = who.email === ADMINISTRATOR.email ? 'People' : 'Your contests';
  await expect(page.getByRole('heading', { name: landing })).toBeVisible();
}

test('an administrator’s panel offers administration and nothing else', async ({ page }) => {
  await signIn(page, ADMINISTRATOR);

  await expect(panel(page).getByRole('link', { name: 'People & access' })).toBeVisible();
  // Absent, not disabled: what the panel draws follows what the account is.
  for (const hostWork of ['All contests', 'Assistant', 'Activity', 'New contest']) {
    await expect(panel(page).getByRole('link', { name: hostWork })).toHaveCount(0);
  }
  await expect(panel(page).getByRole('button', { name: 'Sign out' })).toBeVisible();
});

test('everyone with access is listed once, by address, with their standing', async ({ page }) => {
  await clearMail();
  await hostInvitedBy(HOST.email, HOST.password);
  await signIn(page, ADMINISTRATOR);

  const table = people(page);
  await expect(table).toBeVisible();

  // The administrator who claimed the deployment, said in words.
  const admin = table.getByRole('row').filter({ hasText: ADMINISTRATOR.email });
  await expect(admin).toHaveCount(1);
  await expect(admin).toContainText('Administrator');

  // Somebody who accepted an invitation appears once, as a host — not twice,
  // once for the account and once for the invitation behind it.
  const host = table.getByRole('row').filter({ hasText: HOST.email });
  await expect(host).toHaveCount(1);
  await expect(host).toContainText('Host');
});

test('a standing is said in words, whatever it is', async ({ page }) => {
  await clearMail();
  await signIn(page, ADMINISTRATOR);

  await page.getByLabel('Email').fill('e2e-people-standing@sobremesa.es');
  await page.getByRole('button', { name: 'Send invitation' }).click();
  const row = people(page).getByRole('row').filter({ hasText: 'e2e-people-standing@sobremesa.es' });
  await expect(row).toContainText('Invited');

  await row.getByRole('button', { name: /^Revoke the invitation for/ }).click();
  await expect(row).toContainText('Invitation revoked');
  // Revoked is not simply the absence of invited: it says which ending this was.
  await expect(row).not.toContainText('Invitation expired');
  // And nothing is offered that would do nothing — it is already withdrawn.
  await expect(row.getByRole('button')).toHaveCount(0);
});

test('an address that already has an account is refused with a reason', async ({ page }) => {
  await clearMail();
  await hostInvitedBy(HOST.email, HOST.password);
  await signIn(page, ADMINISTRATOR);

  // Counted only once the table is really there: counting a locator that has not
  // rendered yet answers 0, and 0 is a number the later assertion accepts.
  await expect(people(page).getByRole('row').filter({ hasText: HOST.email })).toHaveCount(1);
  const before = await people(page).getByRole('row').filter({ hasText: HOST.email }).count();
  await page.getByLabel('Email').fill(HOST.email);
  await page.getByRole('button', { name: 'Send invitation' }).click();

  await expect(page.getByRole('alert')).toContainText(/already registered/i);
  // Refused means refused: no second entry for them.
  await expect(people(page).getByRole('row').filter({ hasText: HOST.email })).toHaveCount(before);
});

test('the people are not a host’s to see', async ({ page }) => {
  await hostInvitedBy(HOST.email, HOST.password);
  await signIn(page, HOST);

  // Nowhere in the panel — not shown and refused, simply not offered.
  await expect(panel(page).getByRole('link', { name: 'People & access' })).toHaveCount(0);
  await expect(panel(page)).not.toContainText('Administrator only');

  await page.goto('/people');
  await expect(page.getByRole('heading', { name: 'This screen is not for you' })).toBeVisible();
  // And nobody's address reaches them on the way to being told.
  await expect(page.getByText(ADMINISTRATOR.email)).toHaveCount(0);
  await expect(people(page)).toHaveCount(0);
});

test('the screen is keyboard-operable and free of accessibility violations', async ({ page }) => {
  await clearMail();
  await signIn(page, ADMINISTRATOR);
  await page.getByLabel('Email').fill('e2e-people-a11y@sobremesa.es');
  await page.getByRole('button', { name: 'Send invitation' }).click();
  // Asserting the standing, not just that a row exists: an address another spec
  // had already enrolled showed up here as a Host, the invite was refused, and a
  // bare row count sailed past it.
  await expect(
    people(page).getByRole('row').filter({ hasText: 'e2e-people-a11y@sobremesa.es' }),
  ).toContainText('Invited');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);

  // A row's action is reachable and says which person it acts on.
  const resend = page.getByRole('button', {
    name: 'Resend the invitation to e2e-people-a11y@sobremesa.es',
  });
  await resend.focus();
  await expect(resend).toBeFocused();
});

test('the screen reads in Spanish, leaving addresses alone', async ({ page }) => {
  await clearMail();
  await signIn(page, ADMINISTRATOR);
  await page.getByLabel('Language').selectOption('es');

  await expect(page.getByRole('heading', { name: 'Personas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar invitación' })).toBeVisible();
  await expect(panel(page, 'Navegación del panel')).toContainText('Personas y acceso');
  // An address is nobody's to translate.
  await expect(page.getByText(ADMINISTRATOR.email)).toBeVisible();
});

test('the screen holds together on a narrow screen', async ({ page }) => {
  await clearMail();
  await signIn(page, ADMINISTRATOR);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/people');
  await expect(people(page)).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
