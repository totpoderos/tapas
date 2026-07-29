import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hostInvitedBy } from './support/hosts.js';

/**
 * Implements tests/e2e/host-chat-panel.feature against a real API (run with the
 * deterministic ASSISTANT_STUB) + the host app in a real browser. The stub maps
 * what the host types to a tool call, so the propose → confirm → act loop runs
 * end-to-end with no live model: "start a draft called X" → create_draft, and
 * "close ... <contest-id>" → close_contest.
 */
const PASSWORD = 'Str0ng!Passw0rd';

function completeContent(name: string) {
  const person = (id: string, partnerId: string) => ({ id, displayName: id, partnerId });
  return {
    name,
    attribution: 'per_person',
    antiBias: 'couples',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: true },
    participants: [person('A', 'B'), person('B', 'A'), person('C', 'D'), person('D', 'C')],
  };
}

async function signInFreshHost(request: APIRequestContext, email: string): Promise<void> {
  await hostInvitedBy(email, PASSWORD);
  await request.post('/auth/login', { data: { email, password: PASSWORD } });
}

async function liveContest(request: APIRequestContext, name: string): Promise<string> {
  const created = await request.post('/drafts', { data: completeContent(name) });
  const draftId = (await created.json()).id as string;
  await request.post(`/drafts/${draftId}/publish`);
  return draftId;
}

async function statusOf(request: APIRequestContext, contestId: string): Promise<string> {
  const res = await request.get(`/contests/${contestId}`);
  return (await res.json()).status as string;
}

async function sendMessage(page: Page, text: string): Promise<void> {
  await page.getByLabel('Message the assistant').fill(text);
  await page.getByRole('button', { name: 'Send' }).click();
}

test('the assistant answers when it needs more detail', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-chat-clarify@sobremesa.es');
  await page.goto('/chat');
  await sendMessage(page, 'what can you do?');

  await expect(page.getByText('Which contest do you mean?')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('the assistant carries out a reversible action and shows what it did', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-chat-create@sobremesa.es');
  await page.goto('/chat');
  await sendMessage(page, 'start a draft called Summer Tapas');

  await expect(page.getByText(/create draft/i)).toBeVisible();
  const drafts = await page.request.get('/drafts');
  const names = (await drafts.json()).map((d: { content: { name: string } }) => d.content.name);
  expect(names).toContain('Summer Tapas');
});

test("the assistant lists the host's contests by name", async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-chat-list@sobremesa.es');
  await liveContest(page.request, 'Tapas Night');
  await page.goto('/chat');
  await sendMessage(page, 'list my contests');

  // The panel shows the actual contest — not a bare "done" ticket.
  const log = page.getByRole('log', { name: 'Conversation' });
  await expect(log.getByText('Tapas Night')).toBeVisible();
});

test("the assistant shows a contest's participants by name", async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-chat-details@sobremesa.es');
  // A contest whose participants are Ana and Bob (so the details are recognisable).
  const created = await page.request.post('/drafts', {
    data: {
      name: 'Tapas Night',
      attribution: 'per_person',
      antiBias: 'none',
      scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'fixed', min: 1, max: 5 }, uniquePerCategory: false },
      participants: [
        { id: 'a', displayName: 'Ana' },
        { id: 'b', displayName: 'Bob' },
      ],
    },
  });
  await page.request.post(`/drafts/${(await created.json()).id}/publish`);
  await page.goto('/chat');
  await sendMessage(page, "who is in Tapas Night");

  const log = page.getByRole('log', { name: 'Conversation' });
  await expect(log.getByText('Ana, Bob')).toBeVisible();
  await expect(log.getByText('Taste')).toBeVisible();
});

test('the assistant adds a participant to a draft by name', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-chat-add-participant@sobremesa.es');
  // A DRAFT (not published) named Tapas Night with Ana and Bob.
  await page.request.post('/drafts', {
    data: {
      name: 'Tapas Night',
      participants: [
        { id: 'a', displayName: 'Ana' },
        { id: 'b', displayName: 'Bob' },
      ],
    },
  });
  await page.goto('/chat');
  await sendMessage(page, 'add Carmen to Tapas Night');

  const log = page.getByRole('log', { name: 'Conversation' });
  await expect(log.getByText('Ana, Bob, Carmen')).toBeVisible();
});

test('the conversation is kept when leaving the panel and coming back', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-chat-persist@sobremesa.es');
  await page.goto('/chat');
  await sendMessage(page, 'hello there');
  const log = page.getByRole('log', { name: 'Conversation' });
  await expect(log.getByText('hello there')).toBeVisible();

  // Leave for the contest list, then return via the Assistant link.
  await page.getByRole('link', { name: 'Back to contests' }).click();
  await expect(page.getByRole('heading', { name: 'Your contests' })).toBeVisible();
  await page.getByRole('link', { name: 'Assistant' }).click();

  // The earlier message (and the assistant's reply) are still on screen.
  await expect(page.getByRole('log', { name: 'Conversation' }).getByText('hello there')).toBeVisible();
});

test('the conversation can be cleared, and stays cleared across a reload', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-chat-clear@sobremesa.es');
  await page.goto('/chat');

  // Nothing to clear on an untouched panel.
  await expect(page.getByRole('button', { name: 'Clear conversation' })).toBeDisabled();

  await sendMessage(page, 'hello there');
  const log = page.getByRole('log', { name: 'Conversation' });
  await expect(log.getByText('hello there')).toBeVisible();

  await page.getByRole('button', { name: 'Clear conversation' }).click();
  await expect(log.getByText('hello there')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Conversation cleared');
  await expect(page.getByRole('button', { name: 'Clear conversation' })).toBeDisabled();

  // It is really gone, not just wiped from the screen — the conversation is kept
  // in sessionStorage, so a reload is what proves the stored copy went too.
  await page.reload();
  await expect(page.getByRole('log', { name: 'Conversation' }).getByText('hello there')).toHaveCount(0);

  // And a fresh conversation starts normally.
  await sendMessage(page, 'what can you do?');
  await expect(page.getByText('Which contest do you mean?')).toBeVisible();
});

test('an approval waiting on the host cannot be cleared out from under itself', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-chat-clear-pending@sobremesa.es');
  const id = await liveContest(page.request, 'Held Cook-off');
  await page.goto('/chat');
  await sendMessage(page, `close contest ${id}`);
  await expect(page.getByRole('button', { name: 'Yes, do it' })).toBeVisible();

  // The confirmation card is modal (role="alertdialog", aria-modal="true", over a
  // full-screen backdrop), so clearing is out of reach until the host settles it.
  // The button is still on the page — it is the backdrop that makes it
  // unclickable — so this asserts ACTIONABILITY, not visibility: a trial click
  // runs Playwright's actionability checks without clicking, and fails because
  // the backdrop intercepts the pointer.
  await expect(page.getByRole('alertdialog')).toHaveAttribute('aria-modal', 'true');
  await expect(
    page.getByRole('button', { name: 'Clear conversation' }).click({ trial: true, timeout: 2000 }),
  ).rejects.toThrow();
  expect(await statusOf(page.request, id)).toBe('live');

  // Dismissing the card puts clearing back within reach.
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Clear conversation' }).click();
  await expect(page.getByRole('status')).toHaveText('Conversation cleared');
  expect(await statusOf(page.request, id)).toBe('live'); // still never carried out
});

test('a destructive action is held behind a confirmation card', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-chat-hold@sobremesa.es');
  const id = await liveContest(page.request, 'Balcony Cook-off');
  await page.goto('/chat');
  await sendMessage(page, `close contest ${id}`);

  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toContainText(/close this contest/i);
  expect(await statusOf(page.request, id)).toBe('live');
});

test('confirming the card carries out the action', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-chat-confirm@sobremesa.es');
  const id = await liveContest(page.request, 'Balcony Cook-off');
  await page.goto('/chat');
  await sendMessage(page, `close contest ${id}`);

  await page.getByRole('button', { name: 'Yes, do it' }).click();

  await expect(page.getByText(/close this contest — now closed/i)).toBeVisible();
  expect(await statusOf(page.request, id)).toBe('closed');
});

test('cancelling the card changes nothing', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-chat-cancel@sobremesa.es');
  const id = await liveContest(page.request, 'Balcony Cook-off');
  await page.goto('/chat');
  await sendMessage(page, `close contest ${id}`);

  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByText(/cancelled — nothing was changed/i)).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(await statusOf(page.request, id)).toBe('live');
});

test('the chat panel is keyboard-operable and has no accessibility violations', async ({ page }) => {
  await signInFreshHost(page.request, 'e2e-chat-a11y@sobremesa.es');
  const id = await liveContest(page.request, 'Balcony Cook-off');
  await page.goto('/chat');
  await sendMessage(page, `close contest ${id}`);
  await expect(page.getByRole('alertdialog')).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);

  // Focus opened on the safe default (Cancel); Tab to the confirm and press Enter.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Yes, do it' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByText(/close this contest — now closed/i)).toBeVisible();
  expect(await statusOf(page.request, id)).toBe('closed');
});
