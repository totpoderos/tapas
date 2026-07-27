import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chat } from '../../src/pages/chat';
import type { AssistantTurn } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
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

describe('Chat panel', () => {
  beforeEach(() => {
    vi.mocked(api.sendAssistantMessage).mockReset();
    vi.mocked(api.confirmAssistantAction).mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it('shows the assistant’s reply when it needs to clarify', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({ kind: 'reply', text: 'Which contest do you mean?' });
    renderChat();
    await send('close it');

    const log = screen.getByRole('log', { name: 'Conversation' });
    expect(within(log).getByText('Which contest do you mean?')).toBeInTheDocument();
    expect(api.confirmAssistantAction).not.toHaveBeenCalled();
  });

  it('shows the action it carried out for a reversible request', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'create_draft',
      text: 'Done — I saved your draft.',
      result: { id: 'd1' },
    });
    renderChat();
    await send('start a draft called Summer Tapas');

    expect(await screen.findByText(/create draft — done/i)).toBeInTheDocument();
    expect(screen.getByText('Done — I saved your draft.')).toBeInTheDocument();
  });

  it('renders the contest list when the assistant lists contests', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'list_my_contests',
      text: '',
      result: [
        { id: 'c1', name: 'Tapas Night', status: 'live', updatedAt: '2026-01-01T00:00:00.000Z' },
        { id: 'c2', name: 'Paella Sunday', status: 'draft', updatedAt: '2026-01-01T00:00:00.000Z' },
      ],
    });
    renderChat();
    await send('list my contests');

    const list = await screen.findByRole('list', { name: 'Contests' });
    expect(within(list).getByText('Tapas Night')).toBeInTheDocument();
    expect(within(list).getByText('Paella Sunday')).toBeInTheDocument();
    // Not the bare "done" ticket — the data is the answer.
    expect(screen.queryByText(/list my contests — done/i)).not.toBeInTheDocument();
  });

  it('renders the matches when the assistant finds a contest by name', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'find_contest',
      text: '',
      result: [{ id: 'c1', name: 'Tapas Night', status: 'live', updatedAt: '2026-01-01T00:00:00.000Z' }],
    });
    renderChat();
    await send('find Tapas Night');

    const list = await screen.findByRole('list', { name: 'Contests' });
    expect(within(list).getByText('Tapas Night')).toBeInTheDocument();
  });

  it('says so when a find turns up nothing, rather than showing an empty result', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'find_contest',
      text: '',
      result: [],
    });
    renderChat();
    await send('find Nonexistent');

    expect(await screen.findByText(/no contest by that name/i)).toBeInTheDocument();
  });

  it('always shows a response, even when the model replies with empty text', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({ kind: 'reply', text: '' });
    renderChat();
    await send('list my contests');

    expect(await screen.findByText(/i didn.t catch that/i)).toBeInTheDocument();
  });

  it('holds a destructive action behind a confirmation card and does not act until accepted', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue(CONFIRM_TURN);
    renderChat();
    await send('close my contest');

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/close this contest/i)).toBeInTheDocument();
    expect(api.confirmAssistantAction).not.toHaveBeenCalled();
  });

  it('carries out the action when the card is accepted, echoing the exact action + token', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue(CONFIRM_TURN);
    vi.mocked(api.confirmAssistantAction).mockResolvedValue({
      kind: 'result',
      action: 'close_contest',
      text: '',
      result: { status: 'closed' },
    });
    renderChat();
    await send('close my contest');

    await userEvent.click(await screen.findByRole('button', { name: 'Yes, do it' }));

    expect(api.confirmAssistantAction).toHaveBeenCalledWith({
      action: 'close_contest',
      args: { contestId: 'c1' },
      confirmationToken: 'tok-123',
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await screen.findByText(/close this contest — now closed/i)).toBeInTheDocument();
  });

  it('changes nothing when the card is cancelled', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue(CONFIRM_TURN);
    renderChat();
    await send('close my contest');

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(api.confirmAssistantAction).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText(/cancelled — nothing was changed/i)).toBeInTheDocument();
  });

  it('moves focus into the confirmation card and closes it on Escape', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue(CONFIRM_TURN);
    renderChat();
    await send('close my contest');

    const dialog = await screen.findByRole('alertdialog');
    // Focus landed on a control inside the card (the safe default: Cancel).
    expect(dialog.contains(document.activeElement)).toBe(true);

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(api.confirmAssistantAction).not.toHaveBeenCalled();
  });

  it('has no accessibility violations, with or without the card', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue(CONFIRM_TURN);
    const { container } = renderChat();
    expect(await axe(container)).toHaveNoViolations();

    await send('close my contest');
    await screen.findByRole('alertdialog');
    expect(await axe(container)).toHaveNoViolations();
  });
});
