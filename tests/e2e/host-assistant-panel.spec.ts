import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/host-assistant-panel.feature against a real API (run with
 * the deterministic ASSISTANT_STUB) + the host app in a real browser.
 *
 * The scenarios the older host-chat-panel.spec.ts already covers — clarifying,
 * clearing, persistence across screens — stay there. This file is about the
 * assistant on the shell: where the panel says it is, the two sides of the
 * conversation, and what a carried-out action leaves behind.
 */
const PASSWORD = 'Str0ng!Passw0rd';

const panel = (page: Page, named = 'Panel navigation') =>
  page.getByRole('navigation', { name: named });

const conversation = (page: Page, named = 'Conversation') =>
  page.getByRole('log', { name: named });

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

async function liveContest(request: APIRequestContext, name: string): Promise<string> {
  const created = await request.post('/drafts', { data: completeContent(name) });
  const draftId = (await created.json()).id as string;
  expect((await request.post(`/drafts/${draftId}/publish`)).ok()).toBe(true);
  return draftId;
}

async function statusOf(request: APIRequestContext, contestId: string): Promise<string> {
  return (await (await request.get(`/contests/${contestId}`)).json()).status as string;
}

async function sendMessage(page: Page, text: string): Promise<void> {
  await page.getByLabel('Message the assistant').fill(text);
  await page.getByRole('button', { name: 'Send' }).click();
}

test('the assistant is on the panel, with the rest of the work still reachable', async ({
  page,
}) => {
  await signInFreshHost(page.request, 'e2e-assistant-panel@sobremesa.es');
  await page.goto('/chat');

  await expect(panel(page).getByRole('link', { name: 'Assistant' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  // Not a dead end: the way back to the contests is part of the panel, not this screen.
  await panel(page).getByRole('link', { name: 'All contests' }).click();
  await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();
});

test('what was asked and what was answered are told apart', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-assistant-sides@sobremesa.es');
  await page.goto('/chat');
  await sendMessage(page, 'what can you do?');

  await expect(conversation(page).getByText('what can you do?')).toBeVisible();
  await expect(conversation(page).getByText('Which contest do you mean?')).toBeVisible();

  /*
   * Told apart by side and by shape, not by colour alone: the host's bubble is
   * squared off at the bottom right, the assistant's at the bottom left. A
   * screenshot cannot assert that, but the geometry can.
   */
  const mine = conversation(page).getByText('what can you do?');
  const theirs = conversation(page).getByText('Which contest do you mean?');
  const [mineBox, theirsBox] = await Promise.all([mine.boundingBox(), theirs.boundingBox()]);
  expect(mineBox!.x).toBeGreaterThan(theirsBox!.x);
  const corners = (locator: typeof mine) =>
    locator.evaluate((el) => {
      const s = getComputedStyle(el);
      return { right: s.borderBottomRightRadius, left: s.borderBottomLeftRadius };
    });
  expect(await corners(mine)).toMatchObject({ right: '4px' });
  expect(await corners(theirs)).toMatchObject({ left: '4px' });
});

test('a destructive action waits, and says which action it is', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-assistant-waits@sobremesa.es');
  const id = await liveContest(page.request, 'Balcony Cook-off');
  await page.goto('/chat');

  await sendMessage(page, `close contest ${id}`);

  const asking = page.getByRole('alertdialog');
  await expect(asking).toBeVisible();
  await expect(asking).toContainText(/close this contest/i);
  // Nothing has happened yet, and the contest can say so itself.
  expect(await statusOf(page.request, id)).toBe('live');
});

test('agreeing carries it out and says what it left behind', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-assistant-agrees@sobremesa.es');
  const id = await liveContest(page.request, 'Balcony Cook-off');
  await page.goto('/chat');
  await sendMessage(page, `close contest ${id}`);

  await page.getByRole('button', { name: 'Yes, do it' }).click();

  await expect(page.getByText(/close this contest — now closed/i)).toBeVisible();
  expect(await statusOf(page.request, id)).toBe('closed');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('declining leaves everything as it was', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-assistant-declines@sobremesa.es');
  const id = await liveContest(page.request, 'Balcony Cook-off');
  await page.goto('/chat');
  await sendMessage(page, `close contest ${id}`);

  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(await statusOf(page.request, id)).toBe('live');
  await expect(page.getByText(/now closed/i)).toHaveCount(0);
});

test('the panel stops calling a contest live once the assistant has closed it', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-assistant-stale@sobremesa.es');
  const id = await liveContest(page.request, 'Balcony Cook-off');
  await page.goto('/chat');
  await expect(panel(page).getByRole('link', { name: /^Live/ })).toContainText('1');

  await sendMessage(page, `close contest ${id}`);
  await page.getByRole('button', { name: 'Yes, do it' }).click();
  await expect(page.getByText(/now closed/i)).toBeVisible();

  /*
   * The assistant is a second path to the same changes. The control room already
   * re-reads the shared list after its own; without the same here the panel goes
   * on saying a contest it has just closed is live.
   */
  await expect(panel(page).getByRole('link', { name: /^Live/ })).toContainText('0');
  await expect(panel(page).getByRole('link', { name: /Closed & revealed/ })).toContainText('1');
});

test('what the assistant did is recorded as the assistant’s', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-assistant-recorded@sobremesa.es');
  const id = await liveContest(page.request, 'Balcony Cook-off');
  await page.goto('/chat');
  await sendMessage(page, `close contest ${id}`);
  await page.getByRole('button', { name: 'Yes, do it' }).click();
  await expect(page.getByText(/now closed/i)).toBeVisible();

  await page.goto(`/log/${id}`);
  await page.getByRole('radio', { name: /Connected tool/ }).check();

  const closed = page
    .getByRole('table', { name: 'Activity' })
    .getByRole('row')
    .filter({ hasText: 'Contest closed' });
  await expect(closed).toHaveCount(1);
  // Through a tool, but still the host's doing, and still one they agreed to.
  await expect(closed).toContainText('you');
  await expect(closed).toContainText('You confirmed');
});

test('an action that could not be carried out is not dressed as success', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-assistant-refused@sobremesa.es');
  const id = await liveContest(page.request, 'Balcony Cook-off');
  // Closed already, so closing it again is refused by the API.
  expect((await page.request.post(`/contests/${id}/close`)).ok()).toBe(true);

  await page.goto('/chat');
  await sendMessage(page, `close contest ${id}`);
  await page.getByRole('button', { name: 'Yes, do it' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  // The refusal must not read as the thing having happened.
  await expect(page.getByText(/now closed/i)).toHaveCount(0);
});

test('a waiting agreement cannot be cleared out from under itself', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-assistant-held@sobremesa.es');
  const id = await liveContest(page.request, 'Balcony Cook-off');
  await page.goto('/chat');
  await sendMessage(page, `close contest ${id}`);
  await expect(page.getByRole('alertdialog')).toHaveAttribute('aria-modal', 'true');

  /*
   * Clearing is in the panel's header now, outside this surface — so this also
   * checks the backdrop still covers what moved out of the page.
   */
  await expect(
    page.getByRole('button', { name: 'Clear conversation' }).click({ trial: true, timeout: 2000 }),
  ).rejects.toThrow();

  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Clear conversation' }).click();
  await expect(page.getByRole('status')).toHaveText('Conversation cleared');
});

test('the assistant is keyboard-operable and free of accessibility violations', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-assistant-a11y@sobremesa.es');
  const id = await liveContest(page.request, 'Balcony Cook-off');
  await page.goto('/chat');

  // Written and sent without a mouse.
  await page.getByLabel('Message the assistant').focus();
  await page.keyboard.type(`close contest ${id}`);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alertdialog')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);

  /*
   * Focus opens on Cancel — the safe default. The design draws agreeing first;
   * that is not followed, because opening focus on the button that closes a
   * contest turns a stray Enter into the thing the card exists to prevent.
   */
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Yes, do it' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByText(/now closed/i)).toBeVisible();
  expect(await statusOf(page.request, id)).toBe('closed');
});

test('the assistant reads in Spanish, leaving what was typed alone', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-assistant-spanish@sobremesa.es');
  await page.goto('/chat');
  await sendMessage(page, 'what can you do?');
  await page.getByLabel('Language').selectOption('es');

  await expect(page.getByRole('heading', { name: 'Asistente' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible();
  // What the host wrote is theirs, not the interface's.
  await expect(conversation(page, 'Conversación').getByText('what can you do?')).toBeVisible();
});

test('the conversation holds together on a narrow screen', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-assistant-narrow@sobremesa.es');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/chat');
  await sendMessage(page, 'what can you do?');
  await expect(conversation(page).getByText('Which contest do you mean?')).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);

  // The composer is what this screen is for: it must still be usable down here.
  const composer = page.getByLabel('Message the assistant');
  await expect(composer).toBeVisible();
  const box = await composer.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
