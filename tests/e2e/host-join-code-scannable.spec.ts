import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/host-join-code-scannable.feature against a real API + the
 * host app in a real browser.
 */
const PASSWORD = 'Str0ng!Passw0rd';

function content(name: string) {
  return {
    name,
    format: 'solo_with_partners',
    closeRule: { when: 'host_trigger' },
    scoring: {
      categories: [{ id: 'taste', name: 'Taste' }],
      range: { type: 'fixed', min: 1, max: 10 },
      uniquePerCategory: false,
    },
    participants: [
      { id: 'ana', displayName: 'Ana', partnerId: 'bob' },
      { id: 'bob', displayName: 'Bob', partnerId: 'ana' },
      { id: 'carmen', displayName: 'Carmen', partnerId: 'dani' },
      { id: 'dani', displayName: 'Dani', partnerId: 'carmen' },
    ],
  };
}

async function hostWithLiveContest(
  page: Page,
  email: string,
): Promise<{ contestId: string; joinCode: string }> {
  await hostInvitedBy(email, PASSWORD);
  await page.request.post('/auth/login', { data: { email, password: PASSWORD } });
  const created = await page.request.post('/drafts', { data: content('Scannable Crawl') });
  const published = await page.request.post(`/drafts/${(await created.json()).id}/publish`);
  const body = await published.json();
  return { contestId: body.id as string, joinCode: body.joinCode as string };
}

test('the host shows the join code as a scannable code', async ({ page }) => {
  const { contestId, joinCode } = await hostWithLiveContest(page, 'e2e-qr-show@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  await page.getByRole('button', { name: 'Show QR' }).click();

  // Named after the code it stands for, which is what a screen-reader user needs.
  await expect(page.getByRole('img', { name: new RegExp(joinCode) })).toBeVisible();
});

test('the code stays readable beside the scannable version, and copying stays offered', async ({
  page,
}) => {
  const { contestId, joinCode } = await hostWithLiveContest(page, 'e2e-qr-beside@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  await page.getByRole('button', { name: 'Show QR' }).click();

  await expect(page.getByText(joinCode)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy code' })).toBeVisible();
});

test('showing can be undone', async ({ page }) => {
  const { contestId, joinCode } = await hostWithLiveContest(page, 'e2e-qr-hide@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  await page.getByRole('button', { name: 'Show QR' }).click();
  await page.getByRole('button', { name: 'Hide QR' }).click();

  await expect(page.getByRole('img', { name: new RegExp(joinCode) })).toHaveCount(0);
  await expect(page.getByText(joinCode)).toBeVisible();
});

test('the scannable code is offered but not shown until it is asked for', async ({ page }) => {
  const { contestId, joinCode } = await hostWithLiveContest(page, 'e2e-qr-offered@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  const show = page.getByRole('button', { name: 'Show QR' });
  await expect(show).toBeVisible();
  await expect(show).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('img', { name: new RegExp(joinCode) })).toHaveCount(0);
});

test('a contest whose results are out offers no scannable code', async ({ page }) => {
  const { contestId, joinCode } = await hostWithLiveContest(page, 'e2e-qr-revealed@sobremesa.es');
  await page.request.post(`/contests/${contestId}/close`);
  await page.request.post(`/contests/${contestId}/reveal`);

  await page.goto(`/contest/${contestId}`);
  await expect(page.getByRole('link', { name: 'See the results' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show QR' })).toHaveCount(0);
  await expect(page.getByText(joinCode)).toHaveCount(0);
});

test('the scannable code can be reached and shown with the keyboard alone', async ({ page }) => {
  const { contestId, joinCode } = await hostWithLiveContest(page, 'e2e-qr-keyboard@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  const show = page.getByRole('button', { name: 'Show QR' });
  await show.focus();
  await expect(show).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('img', { name: new RegExp(joinCode) })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hide QR' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});

test('the scannable code stays dark-on-light in the dark theme', async ({ page }) => {
  const { contestId, joinCode } = await hostWithLiveContest(page, 'e2e-qr-themes@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  await page.getByRole('button', { name: 'Show QR' }).click();
  const code = page.getByRole('img', { name: new RegExp(joinCode) });
  await expect(code).toBeVisible();

  /**
   * A QR is a machine-readable target, not a surface, and the standard assumes dark
   * modules on a light ground. Following the theme inverts it, which some scanners
   * refuse — so the check is not "it contrasts" but "the modules are still the dark
   * ones", in both themes.
   */
  const brightness = async () =>
    code.evaluate((svg) => {
      const plate = svg.parentElement!;
      const luma = (colour: string) => {
        const [r, g, b] = colour.match(/\d+/g)!.map(Number) as [number, number, number];
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      return {
        modules: luma(getComputedStyle(svg).color),
        ground: luma(getComputedStyle(plate).backgroundColor),
      };
    });

  const light = await brightness();
  expect(light.modules).toBeLessThan(light.ground);

  await page.getByRole('button', { name: /Switch to dark theme/ }).click();
  // The page really did change theme...
  await expect(page.getByRole('button', { name: /Switch to light theme/ })).toBeVisible();
  // ...and the code did not invert with it.
  const dark = await brightness();
  expect(dark.modules).toBeLessThan(dark.ground);
  expect(dark.ground).toBeCloseTo(light.ground, 0);
});

test('showing the scannable code introduces no accessibility violations', async ({ page }) => {
  const { contestId } = await hostWithLiveContest(page, 'e2e-qr-a11y@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  await page.getByRole('button', { name: 'Show QR' }).click();
  await expect(page.getByRole('img')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('the scannable code reads in Spanish, and the join code is unchanged', async ({ page }) => {
  const { contestId, joinCode } = await hostWithLiveContest(page, 'e2e-qr-spanish@sobremesa.es');

  await page.goto(`/contest/${contestId}`);
  await page.getByLabel('Language').selectOption('es');
  await page.getByRole('button', { name: 'Mostrar QR' }).click();

  await expect(page.getByRole('button', { name: 'Ocultar QR' })).toBeVisible();
  await expect(
    page.getByRole('img', { name: new RegExp(`Código escaneable.*${joinCode}`) }),
  ).toBeVisible();
  await expect(page.getByText(joinCode)).toBeVisible();
});

test('the scannable code survives 200% zoom on a narrow screen', async ({ page }) => {
  const { contestId, joinCode } = await hostWithLiveContest(page, 'e2e-qr-zoom@sobremesa.es');

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/contest/${contestId}`);
  await page.getByRole('button', { name: 'Show QR' }).click();
  // 200% zoom, as a doubled root font size — the code is sized in `em`, so it grows
  // with the text rather than staying a fixed square beside type twice its size.
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });

  const code = page.getByRole('img', { name: new RegExp(joinCode) });
  await expect(code).toBeVisible();
  const box = await code.boundingBox();
  // Still square, still inside the viewport, and not shrunk to nothing.
  expect(box!.width).toBeGreaterThan(100);
  expect(box!.width).toBeLessThanOrEqual(375);
  expect(Math.abs(box!.width - box!.height)).toBeLessThan(2);

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
});
