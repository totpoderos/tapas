import {
  test,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/host-deletes-a-contest.feature. Deleting is the only
 * action in the product with no undo, so what these check is the guard: the host
 * is always asked, the ask gets harder once other people have put something in,
 * and someone still using the contest finds out rather than being left staring at
 * a screen that will never update.
 */
const API = 'http://localhost:3100';
const HOST_WEB = 'http://localhost:5173';
const PARTICIPANT = 'http://localhost:5174';
const PASSWORD = 'Str0ng!Passw0rd';

function content(name: string) {
  return {
    name,
    format: 'solo',
    closeRule: { when: 'host_trigger' },
    scoring: {
      categories: [{ id: 'taste', name: 'Taste' }],
      range: { type: 'fixed', min: 1, max: 5 },
      uniquePerCategory: false,
    },
    participants: [
      { id: 'ana', displayName: 'Ana' },
      { id: 'bob', displayName: 'Bob' },
    ],
  };
}

async function publish(page: Page, email: string, name: string) {
  await hostInvitedBy(email, PASSWORD);
  await page.request.post(`${HOST_WEB}/auth/login`, { data: { email, password: PASSWORD } });
  const created = await page.request.post(`${HOST_WEB}/drafts`, { data: content(name) });
  const published = await page.request.post(
    `${HOST_WEB}/drafts/${(await created.json()).id}/publish`,
  );
  const body = await published.json();
  return { contestId: body.id as string, joinCode: body.joinCode as string };
}

/** Bob claims a place through the API, so the contest counts as "taken part in". */
async function bobJoins(joinCode: string, contestId: string): Promise<void> {
  const ctx: APIRequestContext = await playwrightRequest.newContext({ baseURL: API });
  await ctx.post(`/contests/${joinCode}/claim`, { data: { participantId: 'bob' } });
  await ctx.post(`/contests/${contestId}/dishes`, { data: { name: 'bob dish' } });
}

const dialog = (page: Page) => page.getByRole('alertdialog');

test('a host deletes a contest nobody has joined', async ({ page }) => {
  const name = 'Quiet Cook-off';
  await publish(page, 'e2e-delete-quiet@sobremesa.es', name);

  await page.goto(`${HOST_WEB}/`);
  await page.getByRole('button', { name: `Delete ${name}` }).click();
  await dialog(page).getByRole('button', { name: 'Delete for good' }).click();

  await expect(page.getByRole('status')).toContainText(`“${name}” was deleted`);
  await expect(page.getByRole('link', { name })).toHaveCount(0);

  await page.reload(); // and it is really gone, not just hidden
  await expect(page.getByRole('link', { name })).toHaveCount(0);
});

test('deleting a contest people have joined demands its name', async ({ page }) => {
  const name = 'Busy Cook-off';
  const { contestId, joinCode } = await publish(page, 'e2e-delete-busy@sobremesa.es', name);
  await bobJoins(joinCode, contestId);

  await page.goto(`${HOST_WEB}/`);
  await page.getByRole('button', { name: `Delete ${name}` }).click();
  await dialog(page).getByRole('button', { name: 'Delete for good' }).click();

  // The API refused (428), so the dialog escalated instead of deleting.
  const field = dialog(page).getByLabel('Contest name');
  await expect(field).toBeVisible();
  await expect(dialog(page).getByRole('button', { name: 'Delete for good' })).toBeDisabled();

  await field.fill('Busy Cook');
  await expect(dialog(page).getByRole('button', { name: 'Delete for good' })).toBeDisabled();

  await field.fill(name);
  await dialog(page).getByRole('button', { name: 'Delete for good' }).click();
  await expect(page.getByRole('status')).toContainText(`“${name}” was deleted`);
});

test('a participant using the contest is told it is gone', async ({ page, browser }) => {
  const name = 'Vanishing Cook-off';
  const { contestId, joinCode } = await publish(page, 'e2e-delete-live@sobremesa.es', name);

  // Ana joins on her own phone and waits on the reveal screen.
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(`${PARTICIPANT}/j/${joinCode}`);
  await guestPage.getByRole('button', { name: 'Ana' }).click();
  await expect(guestPage.getByRole('heading', { name: /your dish, ana/i })).toBeVisible();
  await guestPage.goto(`${PARTICIPANT}/reveal`);
  await expect(guestPage.getByText(/almost there/i)).toBeVisible();

  // The host deletes it from the control room while she waits.
  await page.goto(`${HOST_WEB}/contest/${contestId}`);
  await page.getByRole('button', { name: 'Delete' }).click();
  await dialog(page).getByRole('button', { name: 'Delete for good' }).click();
  await dialog(page).getByLabel('Contest name').fill(name);
  await dialog(page).getByRole('button', { name: 'Delete for good' }).click();

  // Deleting takes the host back to their list, and the contest is not on it.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name })).toHaveCount(0);

  // Her waiting screen stops waiting and says what happened.
  await expect(guestPage.getByRole('heading', { name: 'This contest is gone' })).toBeVisible({
    timeout: 10_000,
  });
  await guest.close();
});

test('backing out of the confirmation destroys nothing', async ({ page }) => {
  const name = 'Kept Cook-off';
  await publish(page, 'e2e-delete-cancel@sobremesa.es', name);

  await page.goto(`${HOST_WEB}/`);
  await page.getByRole('button', { name: `Delete ${name}` }).click();
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();

  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('link', { name })).toBeVisible();
});

test('the confirmation is keyboard-operable and has no accessibility violations', async ({
  page,
}) => {
  const name = 'Accessible Cook-off';
  const { contestId, joinCode } = await publish(page, 'e2e-delete-a11y@sobremesa.es', name);
  await bobJoins(joinCode, contestId);

  await page.goto(`${HOST_WEB}/`);
  await page.getByRole('button', { name: `Delete ${name}` }).click();
  await dialog(page).getByRole('button', { name: 'Delete for good' }).click();
  await expect(dialog(page).getByLabel('Contest name')).toBeVisible();

  // Focus must not leave the dialog, even though the confirm button is disabled
  // until the name matches — a disabled control is not focusable, so a trap that
  // treated it as the last stop would let Tab fall out.
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab');
    await expect(dialog(page).locator(':focus')).toHaveCount(1);
  }

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
