import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chat } from '../../src/pages/chat';
import type { AssistantTurn } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual =
    await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, sendAssistantMessage: vi.fn(), confirmAssistantAction: vi.fn() };
});
import * as api from '../../src/api/client';

const CONFIRM_TURN: AssistantTurn = {
  kind: 'confirm',
  action: 'close_contest',
  args: { contestId: 'c1' },
  confirmationToken: 'tok-123',
  message: 'I’d like to close your contest.',
};

function renderChat() {
  return render(
    <MemoryRouter initialEntries={['/chat']}>
      <Chat />
    </MemoryRouter>,
  );
}

async function send(text: string) {
  await userEvent.type(screen.getByLabelText('Message the assistant'), text);
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
}

const clearButton = () => screen.getByRole('button', { name: 'Clear conversation' });
const conversation = () => screen.getByRole('log', { name: 'Conversation' });

/**
 * A conversation lives in three places: what is on screen, the history handed to
 * the model on every turn, and the copy in sessionStorage that survives leaving
 * the panel. Clearing has to empty all three — and only the first is visible, so
 * the tests that matter most here assert on the other two.
 */
describe('clearing the assistant conversation', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(api.sendAssistantMessage).mockReset();
    vi.mocked(api.confirmAssistantAction).mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it('takes the conversation off the screen', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'reply',
      text: 'Which contest do you mean?',
    });
    renderChat();
    await send('close it');
    expect(within(conversation()).getByText('Which contest do you mean?')).toBeInTheDocument();

    await userEvent.click(clearButton());

    expect(within(conversation()).queryByText('Which contest do you mean?')).not.toBeInTheDocument();
    expect(within(conversation()).queryByText('close it')).not.toBeInTheDocument();
  });

  // The one that cannot be seen: a clear that resets the screen but not the
  // history looks perfect and leaves the model reading the old conversation.
  it('stops telling the assistant what was cleared', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({ kind: 'reply', text: 'Which one?' });
    renderChat();
    await send('close it');

    await userEvent.click(clearButton());
    await send('publish Summer Tapas');

    const lastCall = vi.mocked(api.sendAssistantMessage).mock.calls.at(-1)!;
    const messages = lastCall[0];
    expect(messages).toEqual([{ role: 'user', content: 'publish Summer Tapas' }]);
  });

  it('does not bring the conversation back after leaving and returning', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({ kind: 'reply', text: 'Which one?' });
    const first = renderChat();
    await send('close it');
    await userEvent.click(clearButton());
    first.unmount();

    renderChat(); // as if the host had gone to another screen and come back
    expect(within(conversation()).queryByText('close it')).not.toBeInTheDocument();
    expect(within(conversation()).queryByText('Which one?')).not.toBeInTheDocument();
  });

  it('lets the host carry straight on', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({ kind: 'reply', text: 'Which one?' });
    renderChat();
    await send('close it');
    await userEvent.click(clearButton());

    vi.mocked(api.sendAssistantMessage).mockResolvedValue({ kind: 'reply', text: 'Done.' });
    await send('publish Summer Tapas');

    expect(within(conversation()).getByText('Done.')).toBeInTheDocument();
    expect(within(conversation()).getByText('publish Summer Tapas')).toBeInTheDocument();
  });

  it('says that the conversation was cleared', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({ kind: 'reply', text: 'Which one?' });
    renderChat();
    await send('close it');
    await userEvent.click(clearButton());

    // Announced outside the feed: emptying a live region announces nothing, and a
    // message inside it would contradict "nothing from the exchange remains".
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Conversation cleared');
    expect(within(conversation()).queryByText(/cleared/i)).not.toBeInTheDocument();
  });

  it('offers nothing to clear on an untouched panel', () => {
    renderChat();
    expect(clearButton()).toBeDisabled();
  });

  it('becomes available once there is something to clear', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({ kind: 'reply', text: 'Which one?' });
    renderChat();
    expect(clearButton()).toBeDisabled();

    await send('close it');
    expect(clearButton()).toBeEnabled();
  });

  /**
   * The function's contract, not a journey a host can take: the confirmation card
   * is modal over a full-screen backdrop, so in a real browser the clear control
   * is unreachable while an approval waits (asserted in the E2E). jsdom does not
   * simulate pointer interception, so this "click" goes through — which makes it
   * a fine test of the reset itself, and a poor one of reachability.
   */
  it('drops an action awaiting approval rather than leaving it live', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue(CONFIRM_TURN);
    renderChat();
    await send('close my contest');
    expect(screen.getByRole('button', { name: 'Yes, do it' })).toBeInTheDocument();

    await userEvent.click(clearButton());

    expect(screen.queryByRole('button', { name: 'Yes, do it' })).not.toBeInTheDocument();
    expect(api.confirmAssistantAction).not.toHaveBeenCalled();
  });

  it('puts the cursor back in the message box', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({ kind: 'reply', text: 'Which one?' });
    renderChat();
    await send('close it');
    await userEvent.click(clearButton());

    expect(screen.getByLabelText('Message the assistant')).toHaveFocus();
  });

  it('does not let an answer still in flight land in the cleared conversation', async () => {
    let settle: (turn: AssistantTurn) => void = () => {};
    vi.mocked(api.sendAssistantMessage).mockReturnValue(
      new Promise<AssistantTurn>((resolve) => {
        settle = resolve;
      }),
    );
    renderChat();
    await send('close it');

    await userEvent.click(clearButton());
    settle({ kind: 'reply', text: 'Which contest do you mean?' }); // arrives after the clear

    expect(
      within(conversation()).queryByText('Which contest do you mean?'),
    ).not.toBeInTheDocument();
  });

  it('has no accessibility violations before or after clearing', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({ kind: 'reply', text: 'Which one?' });
    const { container } = renderChat();
    await send('close it');
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(clearButton());
    expect(await axe(container)).toHaveNoViolations();
  });
});
