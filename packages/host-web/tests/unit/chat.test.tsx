import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chat } from '../../src/pages/chat';
import type { AssistantTurn } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return {
    ...actual,
    sendAssistantMessage: vi.fn(),
    confirmAssistantAction: vi.fn(),
    listContests: vi.fn(),
  };
});
import * as api from '../../src/api/client';
import { WithPanelSlots } from './support/panel-slots';
import { WithContests } from './support/with-contests';

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
      <WithContests>
        <WithPanelSlots>
          <Chat />
        </WithPanelSlots>
      </WithContests>
    </MemoryRouter>,
  );
}

async function send(text: string) {
  await userEvent.type(screen.getByLabelText('Message the assistant'), text);
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
}

describe('Chat panel', () => {
  beforeEach(() => {
    sessionStorage.clear(); // the conversation persists there — don't leak between tests
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

  it('puts what happened into words even when the model says nothing', async () => {
    // gemma4 and friends routinely call a tool and contribute no sentence.
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'create_draft',
      text: '',
      result: { id: 'd1' },
    });
    renderChat();
    await send('start a draft called Summer Tapas');

    // The ticket is there, and so is a sentence — not a bare ticket.
    expect(await screen.findByText(/create draft — done/i)).toBeInTheDocument();
    expect(screen.getByText(/^Done — create draft\.$/i)).toBeInTheDocument();
  });

  it('says an action did not happen, and why', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'failed',
      action: 'publish_contest',
      message: 'The draft is missing its scoring rules.',
    });
    renderChat();
    await send('publish Bare');

    // Announced, names the action, and carries the reason — never a green tick.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/didn’t happen/i);
    expect(alert).toHaveTextContent('The draft is missing its scoring rules.');
    expect(screen.queryByText(/publish contest — done/i)).not.toBeInTheDocument();
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

  it("renders a contest's details (participants + categories) when asked", async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'get_contest_details',
      text: '',
      result: {
        details: { id: 'c1', name: 'Tapas Night', status: 'live', participants: ['Ana', 'Bob'], categories: ['Taste'] },
      },
    });
    renderChat();
    await send('who is in Tapas Night');

    expect(await screen.findByText('Ana, Bob')).toBeInTheDocument();
    expect(screen.getByText('Taste')).toBeInTheDocument();
    expect(screen.getByText('Taking part')).toBeInTheDocument();
  });

  it('asks which one when a details request matches several contests', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'get_contest_details',
      text: '',
      result: {
        candidates: [
          { id: 'c1', name: 'Tapas Night', status: 'live', updatedAt: '2026-01-01T00:00:00.000Z' },
          { id: 'c2', name: 'Tapas Night', status: 'draft', updatedAt: '2026-01-01T00:00:00.000Z' },
        ],
      },
    });
    renderChat();
    await send('details of Tapas Night');

    expect(await screen.findByText(/which one/i)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Contests' })).toBeInTheDocument();
  });

  it('says so when a details request matches nothing', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'get_contest_details',
      text: '',
      result: { candidates: [] },
    });
    renderChat();
    await send('details of Nope');

    expect(await screen.findByText(/no contest by that name/i)).toBeInTheDocument();
  });

  /*
   * The panel used to pick a rendering from the tool's NAME, so only the three
   * tools known to answer this way could ask "which one?". Every tool answers
   * that way now — a close that names a shared name must ask, not announce.
   */
  it('asks which one when an action — not just a read — names a shared name', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'close_contest',
      text: '',
      result: {
        candidates: [
          { id: 'c1', name: 'Tapas Night', status: 'live', updatedAt: '2026-01-01T00:00:00.000Z' },
          { id: 'c2', name: 'Tapas Night', status: 'live', updatedAt: '2026-01-01T00:00:00.000Z' },
        ],
      },
    });
    renderChat();
    await send('close Tapas Night');

    expect(await screen.findByText(/which one/i)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Contests' })).toBeInTheDocument();
    // The one thing it must never say: that the contest was closed.
    expect(screen.queryByText(/now closed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/done/i)).not.toBeInTheDocument();
  });

  /*
   * A rule change reports the state it produced, not the call that was made:
   * the host reads the panel to know where their contest stands. It works
   * because the panel reads the shape of the answer — add_category returns the
   * draft's details like any other draft change, so it needed no panel change
   * of its own.
   */
  it('reports what a draft is now judged on after the assistant changes a rule', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'add_category',
      text: '',
      result: {
        details: {
          id: 'd1',
          name: 'Tapas Night',
          status: 'draft',
          participants: ['Ana', 'Bob'],
          categories: ['Taste', 'Presentation'],
        },
      },
    });
    renderChat();
    await send('judge Tapas Night on Presentation');

    expect(await screen.findByText('Taste, Presentation')).toBeInTheDocument();
  });

  /*
   * One message may ask for several things. Before this the panel drew the first
   * and dropped the rest — and a run of steps fell through to the branch that
   * assumes a confirmation, opening a card for an action with no name.
   */
  it('draws every step of a run, in the order they were asked for', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'steps',
      notReached: [],
      steps: [
        { kind: 'result', action: 'create_draft', text: '', result: { id: 'd1', name: 'Tapas' } },
        {
          kind: 'result',
          action: 'add_category',
          text: '',
          result: {
            details: {
              id: 'd1',
              name: 'Tapas',
              status: 'draft',
              participants: [],
              categories: ['Taste'],
            },
          },
        },
        {
          kind: 'result',
          action: 'add_participant',
          text: '',
          result: {
            details: {
              id: 'd1',
              name: 'Tapas',
              status: 'draft',
              participants: ['Carlos'],
              categories: ['Taste'],
            },
          },
        },
      ],
    });
    renderChat();
    await send('create Tapas, judge it on Taste, add Carlos');

    expect(await screen.findByText('Carlos')).toBeInTheDocument();
    expect(screen.getByText('✓ create draft — done')).toBeInTheDocument();
    // No confirmation card: a run of results is not something to approve.
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  /*
   * The silent drop, in its new place. A host who asked for three things and had
   * the run stop at the second must not be left assuming the third happened.
   */
  it('names what the run did not reach', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'steps',
      notReached: ['rename_contest', 'add_participant'],
      steps: [
        { kind: 'result', action: 'add_category', text: '', result: { id: 'd1' } },
        {
          kind: 'confirm',
          action: 'publish_contest',
          args: { contest: 'Tapas' },
          confirmationToken: 'tok',
          message: 'This can’t be undone. Confirm to publish contest.',
        },
      ],
    });
    renderChat();
    await send('add Taste, publish it, rename it, add Carlos');

    expect(await screen.findByText(/not done yet/i)).toBeInTheDocument();
    expect(screen.getByText(/rename contest, add participant/i)).toBeInTheDocument();
    // And the confirmation the run stopped on is still put to the host.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('shows a failed step as a refusal and still names what was not reached', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'steps',
      notReached: ['add_category'],
      steps: [
        { kind: 'result', action: 'add_participant', text: '', result: { id: 'd1' } },
        { kind: 'failed', action: 'add_category', message: 'This contest is already judged on "Taste".' },
      ],
    });
    renderChat();
    await send('add Carlos, judge it on Taste twice');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/already judged on/i);
    expect(screen.getByText(/not done yet/i)).toBeInTheDocument();
  });

  /*
   * A pairing is invisible without this. `set_partner` answers with the same
   * details it would have answered with before, so a host who asks to pair two
   * people has no sign that it happened.
   */
  it('says who is now paired with whom after the assistant pairs two people', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'set_partner',
      text: '',
      result: {
        details: {
          id: 'd1',
          name: 'Tapas Night',
          status: 'draft',
          participants: ['Ana', 'Bob', 'Carmen', 'Dan'],
          categories: ['Taste'],
          pairs: [
            ['Ana', 'Bob'],
            ['Carmen', 'Dan'],
          ],
        },
      },
    });
    renderChat();
    await send('pair Ana with Bob in Tapas Night');

    expect(await screen.findByText('Ana & Bob, Carmen & Dan')).toBeInTheDocument();
  });

  /*
   * The reported bug, at the layer that can see it. A contest built entirely in
   * this panel was one unasked question short of publishable — its format — and
   * nothing on screen said so until publishing refused, by which point the host
   * had left for the review form. What is outstanding is said where it can still
   * be acted on.
   */
  it('says what a draft still needs after the assistant changes it', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'set_score_uniqueness',
      text: '',
      result: {
        details: {
          id: 'd1',
          name: 'Tapas',
          status: 'draft',
          participants: ['Carlos', 'Alba', 'Juan'],
          categories: ['Taste', 'Originality'],
          stillNeeded: ['format'],
        },
      },
    });
    renderChat();
    await send('allow duplicate scores in Tapas');

    expect(await screen.findByText(/still needs to say what kind of contest it is/i)).toBeInTheDocument();
  });

  /*
   * Naming the three kinds is what makes the note answerable. "It still needs to
   * say what kind of contest it is" leaves a host guessing at what the kinds
   * are; the assistant cannot fill that in, because this model returns no words
   * at all while it is calling tools.
   */
  it('names the kinds of contest a host can choose between', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'add_participant',
      text: '',
      result: {
        details: {
          id: 'd1',
          name: 'Tapas',
          status: 'draft',
          participants: ['Carlos'],
          categories: ['Taste'],
          stillNeeded: ['format'],
        },
      },
    });
    renderChat();
    await send('add Carlos to Tapas');

    const asked = await screen.findByText(/still needs to say/i);
    expect(asked).toHaveTextContent(/everyone on their own/i);
    expect(asked).toHaveTextContent(/partners kept apart/i);
    expect(asked).toHaveTextContent(/couples cooking together/i);
  });

  /* The other two gaps are answerable as they stand — no list of choices to give. */
  it('names no choices when what is missing is not the kind of contest', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'set_format',
      text: '',
      result: {
        details: {
          id: 'd1',
          name: 'Tapas',
          status: 'draft',
          participants: ['Carlos'],
          categories: [],
          stillNeeded: ['scoring'],
        },
      },
    });
    renderChat();
    await send('everyone on their own in Tapas');

    const said = await screen.findByText(/still needs to say how it is scored/i);
    expect(said).not.toHaveTextContent(/everyone on their own/i);
  });

  it('names each thing a draft still needs', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'create_draft',
      text: '',
      // The draft as it comes back from creating one: the answer IS the draft,
      // so what it still needs rides at the top level, not under `details`.
      result: { id: 'd1', name: 'Tapas', stillNeeded: ['format', 'participants', 'scoring'] },
    });
    renderChat();
    await send('create a contest called Tapas');

    const said = await screen.findByText(/still needs to say/i);
    expect(said).toHaveTextContent(/what kind of contest it is/i);
    expect(said).toHaveTextContent(/who is taking part/i);
    expect(said).toHaveTextContent(/how it is scored/i);
  });

  /*
   * A ready draft must not carry an empty warning. An unfinished contest and a
   * finished one have to read differently, which is the whole point of saying it.
   */
  it('says nothing is needed for a draft that has said everything', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'set_format',
      text: '',
      result: {
        details: {
          id: 'd1',
          name: 'Tapas',
          status: 'draft',
          participants: ['Carlos'],
          categories: ['Taste'],
        },
      },
    });
    renderChat();
    await send('everyone on their own in Tapas');

    expect(await screen.findByText('Carlos')).toBeInTheDocument();
    expect(screen.queryByText(/still needs/i)).not.toBeInTheDocument();
  });

  it('shows no pairing row for a contest that keeps nobody apart', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'add_participant',
      text: '',
      result: {
        details: {
          id: 'd1',
          name: 'Tapas Night',
          status: 'draft',
          participants: ['Ana', 'Bob'],
          categories: ['Taste'],
        },
      },
    });
    renderChat();
    await send('add Bob to Tapas Night');

    expect(await screen.findByText('Ana, Bob')).toBeInTheDocument();
    expect(screen.queryByText(/paired up/i)).not.toBeInTheDocument();
  });

  /*
   * A refused change is a refusal carrying its reason — not the quiet note that
   * means "that name is not one contest", and certainly not a ticket.
   */
  it('shows a refused rule change as a refusal, with the reason', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'failed',
      action: 'add_category',
      message: 'This contest is already judged on "Taste".',
    });
    renderChat();
    await send('judge Tapas Night on Taste');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/already judged on/i);
  });

  /*
   * Asking "which one?" is only worth doing if the host can answer. Two rows
   * both reading "Tapas Night — Live" is the same dead end as not asking, so
   * each candidate has to carry the thing that tells it apart.
   */
  it('gives the host something to tell same-named candidates apart by', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'close_contest',
      text: '',
      result: {
        candidates: [
          {
            id: 'c1',
            name: 'Tapas Night',
            status: 'live',
            updatedAt: '2026-01-01T00:00:00.000Z',
            joinCode: 'AAAA1111',
          },
          {
            id: 'c2',
            name: 'Tapas Night',
            status: 'live',
            updatedAt: '2026-01-02T00:00:00.000Z',
            joinCode: 'BBBB2222',
          },
        ],
      },
    });
    renderChat();
    await send('close Tapas Night');

    const listed = within(await screen.findByRole('list', { name: 'Contests' }));
    expect(listed.getByText(/AAAA1111/)).toBeInTheDocument();
    expect(listed.getByText(/BBBB2222/)).toBeInTheDocument();
  });

  // A draft has no join code yet, so when it last changed is what separates
  // this year's "Tapas Night" from last year's.
  it('falls back to when it last changed for candidates with no join code', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'publish_contest',
      text: '',
      result: {
        candidates: [
          { id: 'd1', name: 'Tapas Night', status: 'draft', updatedAt: '2020-03-04T00:00:00.000Z' },
          { id: 'd2', name: 'Tapas Night', status: 'draft', updatedAt: '2021-06-07T00:00:00.000Z' },
        ],
      },
    });
    renderChat();
    await send('publish Tapas Night');

    const listed = within(await screen.findByRole('list', { name: 'Contests' }));
    expect(listed.getByText(/2020/)).toBeInTheDocument();
    expect(listed.getByText(/2021/)).toBeInTheDocument();
  });

  /*
   * A mistyped name and a refused action are different things, and a host acts
   * on them differently — retype it, or deal with why it could not be done. A
   * refusal is an alert with its reason; this is a quiet note.
   */
  it('says a name matched nothing without dressing it as a failed action', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'close_contest',
      text: '',
      result: { candidates: [] },
    });
    renderChat();
    await send('close Sunday Roast');

    expect(await screen.findByText(/no contest by that name/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/now closed/i)).not.toBeInTheDocument();
  });

  it('says no DRAFT by that name when the tool only ever acts on a draft', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'publish_contest',
      text: '',
      result: { candidates: [] },
    });
    renderChat();
    await send('publish Sunday Roast');

    expect(await screen.findByText(/no draft by that name/i)).toBeInTheDocument();
  });

  /*
   * The fallback that makes the shape-reading safe to extend: a tool the panel
   * has never seen still gets a truthful, if terse, report rather than being
   * mistaken for a shape it resembles.
   */
  it('falls back to the plain ticket for a result it does not recognise', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'set_score_range',
      text: '',
      result: { min: 1, max: 5 },
    });
    renderChat();
    await send('score it between 1 and 5');

    // The ticket, and the sentence that goes with it — terse, but true.
    expect(await screen.findByText('✓ set score range — done')).toBeInTheDocument();
    expect(screen.getByText('Done — set score range.')).toBeInTheDocument();
  });

  /*
   * An array of things that are not contests must not be drawn as a contest
   * list — that would be a screen of "Unnamed contest", which reads as data the
   * host does not have.
   */
  it('does not draw an array of non-contests as a contest list', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'get_results',
      text: 'Here are the totals.',
      result: [{ categoryId: 'taste', total: 12 }],
    });
    renderChat();
    await send('results for Tapas Night');

    expect(await screen.findByText('Here are the totals.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Contests' })).not.toBeInTheDocument();
    expect(screen.queryByText(/unnamed contest/i)).not.toBeInTheDocument();
  });

  it('renders the updated participants after adding one', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({
      kind: 'result',
      action: 'add_participant',
      text: '',
      result: { details: { id: 'd1', name: 'Tapas Night', status: 'draft', participants: ['Ana', 'Bob', 'Carmen'], categories: [] } },
    });
    renderChat();
    await send('add Carmen to Tapas Night');

    expect(await screen.findByText('Ana, Bob, Carmen')).toBeInTheDocument();
  });

  it('returns focus to the composer after the assistant responds', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({ kind: 'reply', text: 'Which contest do you mean?' });
    renderChat();
    await send('close it');

    await screen.findByText('Which contest do you mean?');
    expect(screen.getByLabelText('Message the assistant')).toHaveFocus();
  });

  it('keeps the conversation when the panel is left and reopened', async () => {
    vi.mocked(api.sendAssistantMessage).mockResolvedValue({ kind: 'reply', text: 'Here is my reply.' });
    const { unmount } = renderChat();
    await send('hello');
    await screen.findByText('Here is my reply.');

    // Navigate away (unmount) and come back (fresh mount) — the conversation is restored.
    unmount();
    renderChat();
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('Here is my reply.')).toBeInTheDocument();
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
