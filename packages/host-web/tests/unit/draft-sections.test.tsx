import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Routes, Route } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DraftWorkspace } from '../../src/pages/draft/draft-workspace';
import { DraftRules } from '../../src/pages/draft/draft-rules';
import { DraftParticipants } from '../../src/pages/draft/draft-participants';
import { ContestsProvider } from '../../src/contests/contests-provider';
import { WithPanelSlots } from './support/panel-slots';
import { ApiError, type DraftContent, type StoredDraft } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return {
    ...actual,
    getDraft: vi.fn(),
    publishDraft: vi.fn(),
    updateDraft: vi.fn(),
    // Publishing re-reads the panel's list, so the provider is in play here too —
    // without this the sidebar would go on calling the new live contest a draft.
    listContests: vi.fn(),
  };
});
import * as api from '../../src/api/client';

const DRAFT: StoredDraft = {
  id: 'd1',
  status: 'draft',
  createdAt: '2026-07-20T10:00:00.000Z',
  updatedAt: '2026-07-20T10:00:00.000Z',
  content: {
    name: 'Summer Tapas',
    format: 'couples',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'fixed', min: 1, max: 5 }, uniquePerCategory: true },
    participants: [
      { id: 'p1', displayName: 'Ana' },
      { id: 'p2', displayName: 'Bruno' },
    ],
  },
};

const RULES = '/review/d1';
const PEOPLE = '/review/d1/people';

/**
 * The two sections on their real routes, with the two ways in the sidebar draws
 * standing in for it.
 *
 * The links matter: moving between the sections has to be a navigation inside one
 * mounted workspace, because that is exactly what the draft surviving the move
 * depends on. Re-rendering at the other address would prove nothing.
 */
function renderDraft(at: string = RULES) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <ContestsProvider>
        <WithPanelSlots>
          <nav aria-label="Panel navigation">
            <Link to={RULES}>Rules</Link>
            <Link to={PEOPLE}>Participants &amp; pairing</Link>
          </nav>
          <Routes>
            <Route path="/review/:id" element={<DraftWorkspace />}>
              <Route index element={<DraftRules />} />
              <Route path="people" element={<DraftParticipants />} />
            </Route>
            <Route path="/" element={<h1>Your contests</h1>} />
            {/* Publishing lands in the control room now — the join code is the very
                next thing a host needs, not another click away on the list. */}
            <Route path="/contest/:id" element={<h1>Control room</h1>} />
          </Routes>
        </WithPanelSlots>
      </ContestsProvider>
    </MemoryRouter>,
  );
}

/** Waits for the draft to be in hand, whichever section it opened on. */
async function loaded() {
  await screen.findByRole('heading', { name: /Edit .Summer Tapas./ });
}

const goTo = (section: 'Rules' | 'Participants & pairing') =>
  userEvent.click(screen.getByRole('link', { name: section }));

/** The content passed to the latest updateDraft call. */
function savedContent(): DraftContent {
  const calls = vi.mocked(api.updateDraft).mock.calls;
  return calls[calls.length - 1]![1];
}

describe('A contest being prepared, in its two sections', () => {
  beforeEach(() => {
    vi.mocked(api.listContests).mockReset().mockResolvedValue([]);
    vi.mocked(api.getDraft).mockReset().mockResolvedValue(DRAFT);
    vi.mocked(api.publishDraft).mockReset().mockResolvedValue('c1');
    vi.mocked(api.updateDraft).mockReset().mockResolvedValue();
  });
  afterEach(() => vi.clearAllMocks());

  describe('what belongs to each section', () => {
    it('settles the rules on the rules, and nothing about the people', async () => {
      renderDraft(RULES);
      await loaded();

      expect(screen.getByLabelText('Contest name')).toHaveValue('Summer Tapas');
      expect(screen.getByRole('radio', { name: 'Couples cook together' })).toBeChecked();
      expect(screen.getByRole('list', { name: 'Scoring categories' })).toHaveTextContent('Taste');

      expect(screen.queryByLabelText('Participant 1 name')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Partner of Ana')).not.toBeInTheDocument();
    });

    it('settles the people on the participants, and nothing about the rules', async () => {
      renderDraft(PEOPLE);
      await loaded();

      expect(screen.getByLabelText('Participant 1 name')).toHaveValue('Ana');
      expect(screen.getByLabelText('Participant 2 name')).toHaveValue('Bruno');
      expect(screen.getByLabelText('Partner of Ana')).toBeInTheDocument();

      expect(screen.queryByLabelText('Contest name')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('radio', { name: 'Couples cook together' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('two views of one contest', () => {
    it('keeps an unsaved change while the host works on the other section', async () => {
      renderDraft(RULES);
      await loaded();

      await userEvent.clear(screen.getByLabelText('Contest name'));
      await userEvent.type(screen.getByLabelText('Contest name'), 'Autumn Tapas');
      await goTo('Participants & pairing');
      await screen.findByLabelText('Participant 1 name');
      await goTo('Rules');

      expect(await screen.findByLabelText('Contest name')).toHaveValue('Autumn Tapas');
      // Nothing was read again: the draft was fetched once, on the way in.
      expect(api.getDraft).toHaveBeenCalledTimes(1);
    });

    it('does not save on the way between the sections', async () => {
      renderDraft(RULES);
      await loaded();

      await userEvent.type(screen.getByLabelText('Contest name'), ' Final');
      await goTo('Participants & pairing');
      await screen.findByLabelText('Participant 1 name');

      expect(api.updateDraft).not.toHaveBeenCalled();
    });

    it('stores a change made on each section with one save', async () => {
      renderDraft(RULES);
      await loaded();

      await userEvent.clear(screen.getByLabelText('Contest name'));
      await userEvent.type(screen.getByLabelText('Contest name'), 'Autumn Tapas');
      await goTo('Participants & pairing');
      await userEvent.type(await screen.findByLabelText('New participant name'), 'Carla');
      await userEvent.click(screen.getByRole('button', { name: 'Add' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(api.updateDraft).toHaveBeenCalledTimes(1);
      expect(savedContent().name).toBe('Autumn Tapas');
      expect(savedContent().participants?.map((p) => p.displayName)).toEqual([
        'Ana',
        'Bruno',
        'Carla',
      ]);
      expect(await screen.findByText('Saved.')).toBeInTheDocument();
    });

    it('stops saying it saved once something else is changed', async () => {
      renderDraft(RULES);
      await loaded();

      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      expect(await screen.findByText('Saved.')).toBeInTheDocument();

      // On the other section, so the note would otherwise sit there over a change
      // it does not cover.
      await goTo('Participants & pairing');
      await userEvent.click(await screen.findByRole('button', { name: 'Remove Bruno' }));

      expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
    });
  });

  describe('saving and publishing, from either section', () => {
    it.each([
      ['the rules', RULES],
      ['the participants', PEOPLE],
    ])('offers saving and publishing on %s', async (_name, at) => {
      renderDraft(at);
      await loaded();

      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Publish/ })).toBeInTheDocument();
    });

    it.each([
      ['the rules', RULES],
      ['the participants', PEOPLE],
    ])('says what is ready and what is not on %s', async (_name, at) => {
      renderDraft(at);
      await loaded();

      const checklist = screen.getByRole('region', { name: 'Publish checklist' });
      expect(checklist).toHaveTextContent('Name set');
      expect(checklist).toHaveTextContent('1 scoring category');
      expect(checklist).toHaveTextContent('Score range fixed 1–5');
      expect(checklist).toHaveTextContent('2 participants without a partner');
    });

    /*
     * Two counts are certain refusals — nobody at all, and one person alone, who
     * gets one dish and may not score their own. Before this the checklist said
     * nothing about people, so a contest with an empty roster read "Everything
     * needed is in place" and was then refused by the server. That is the first
     * thing a host sees after the form that starts a contest hands them over.
     */
    it('says nobody is taking part, and does not call the contest ready', async () => {
      vi.mocked(api.getDraft).mockResolvedValue({
        ...DRAFT,
        content: { ...DRAFT.content, participants: [] },
      });
      renderDraft(RULES);
      await loaded();

      const checklist = screen.getByRole('region', { name: 'Publish checklist' });
      expect(checklist).toHaveTextContent('Nobody is taking part yet');
      expect(checklist).not.toHaveTextContent('Everything needed is in place');
    });

    it('says why a second person is needed when only one is taking part', async () => {
      vi.mocked(api.getDraft).mockResolvedValue({
        ...DRAFT,
        content: { ...DRAFT.content, participants: [{ id: 'p1', displayName: 'Ana' }] },
      });
      renderDraft(RULES);
      await loaded();

      const checklist = screen.getByRole('region', { name: 'Publish checklist' });
      expect(checklist).toHaveTextContent('at least two are needed');
      // The reason, not just the rule: otherwise a host wonders if it is for pairs.
      expect(checklist).toHaveTextContent('nobody may score their own dish');
      expect(checklist).not.toHaveTextContent('Everything needed is in place');
    });

    it('counts the people once there are enough of them', async () => {
      renderDraft(RULES);
      await loaded();

      const checklist = screen.getByRole('region', { name: 'Publish checklist' });
      expect(checklist).toHaveTextContent('2 people taking part');
      expect(checklist).not.toHaveTextContent('Nobody is taking part');
    });

    it('counts a participant whose name has not been typed yet', async () => {
      renderDraft(PEOPLE);
      await loaded();

      // Sent by buildContent() and counted by the compiler, so counted here too —
      // filtering would make the checklist disagree with what publishing sees.
      await userEvent.type(await screen.findByLabelText('New participant name'), 'Carla');
      await userEvent.click(screen.getByRole('button', { name: 'Add' }));
      await userEvent.clear(screen.getByLabelText('Participant 3 name'));

      expect(screen.getByRole('region', { name: 'Publish checklist' })).toHaveTextContent(
        '3 people taking part',
      );
    });

    it('publishes from the rules and lands in the control room', async () => {
      renderDraft(RULES);
      await loaded();

      await userEvent.click(screen.getByRole('button', { name: /Publish/ }));

      expect(api.publishDraft).toHaveBeenCalledWith('d1');
      // Where the join code is, which is what a host needs the moment it goes live.
      expect(await screen.findByRole('heading', { name: 'Control room' })).toBeInTheDocument();
    });

    it('publishes from the participants and lands in the control room', async () => {
      renderDraft(PEOPLE);
      await loaded();

      await userEvent.click(screen.getByRole('button', { name: /Publish/ }));

      expect(api.publishDraft).toHaveBeenCalledWith('d1');
      expect(await screen.findByRole('heading', { name: 'Control room' })).toBeInTheDocument();
    });

    it('leaves the host on the participants when publishing is refused', async () => {
      vi.mocked(api.publishDraft).mockRejectedValue(
        new ApiError(422, 'INCOMPLETE_DRAFT', 'The draft is missing its scoring rules.'),
      );
      renderDraft(PEOPLE);
      await loaded();

      await userEvent.click(screen.getByRole('button', { name: /Publish/ }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/can.t go live yet/i);
      expect(alert).toHaveTextContent(/missing its scoring rules/i);
      // Still where they were, with the people still in front of them.
      expect(screen.getByLabelText('Participant 1 name')).toBeInTheDocument();
    });

    /*
     * The name is typed on the rules, so a host saving from the participants would
     * be refused by a field they cannot see. The reason is given where they are.
     */
    it('says a name is needed when saving from the participants', async () => {
      renderDraft(RULES);
      await loaded();

      await userEvent.clear(screen.getByLabelText('Contest name'));
      await goTo('Participants & pairing');
      await screen.findByLabelText('Participant 1 name');
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(api.updateDraft).not.toHaveBeenCalled();
      expect(await screen.findByRole('alert')).toHaveTextContent('A name is required.');
    });

    it('says a name is needed beside the field when saving from the rules', async () => {
      renderDraft(RULES);
      await loaded();

      await userEvent.clear(screen.getByLabelText('Contest name'));
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(api.updateDraft).not.toHaveBeenCalled();
      expect(screen.getAllByText('A name is required.').length).toBeGreaterThan(0);
    });
  });

  describe('the rules', () => {
    it("saves a change to the contest's format", async () => {
      renderDraft(RULES);
      await loaded();

      await userEvent.click(screen.getByRole('radio', { name: 'Everyone on their own' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(api.updateDraft).toHaveBeenCalledWith('d1', expect.anything());
      expect(savedContent().format).toBe('solo');
      expect(await screen.findByText('Saved.')).toBeInTheDocument();
    });

    it('asks one question about the format, not two', async () => {
      renderDraft(RULES);
      await loaded();

      // Three answers to one question. A second group about bias would be the
      // grid this change exists to remove.
      const formats = screen.getByRole('group', { name: 'What kind of contest is this?' });
      expect(within(formats).getAllByRole('radio')).toHaveLength(3);
      expect(screen.queryByText(/Guarding against bias/)).not.toBeInTheDocument();
    });

    it('says what each format means, not just what it is called', async () => {
      renderDraft(RULES);
      await loaded();

      expect(
        screen.getByText('Each person cooks their own dish and scores every other dish.'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Each couple cooks one dish. Nobody scores their own couple’s dish, and everyone needs a partner.',
        ),
      ).toBeInTheDocument();
    });

    it('does not ask about pairing when everyone is on their own', async () => {
      renderDraft(RULES);
      await loaded();

      await userEvent.click(screen.getByRole('radio', { name: 'Everyone on their own' }));
      await goTo('Participants & pairing');

      // A partner would do nothing under this format, so it is not asked for.
      expect(await screen.findByLabelText('Participant 1 name')).toBeInTheDocument();
      expect(screen.queryByLabelText('Partner of Ana')).not.toBeInTheDocument();
      expect(screen.queryByText(/without a partner/)).not.toBeInTheDocument();
    });

    it('offers a partner without insisting on one when partners are kept apart', async () => {
      renderDraft(RULES);
      await loaded();

      await userEvent.click(
        screen.getByRole('radio', { name: 'Everyone on their own, partners kept apart' }),
      );
      await goTo('Participants & pairing');

      expect(await screen.findByLabelText('Partner of Ana')).toBeInTheDocument();
      // Offered, but nobody is short of anything for leaving it alone.
      expect(screen.queryByText('needs a partner')).not.toBeInTheDocument();
      expect(screen.queryByText(/without a partner/)).not.toBeInTheDocument();
    });

    it('says everything is in place once nothing is missing', async () => {
      renderDraft(PEOPLE);
      await loaded();
      await userEvent.selectOptions(screen.getByLabelText('Partner of Ana'), 'p2');
      await goTo('Rules');

      const checklist = await screen.findByRole('region', { name: 'Publish checklist' });
      expect(checklist).toHaveTextContent('Everything needed is in place');
      expect(checklist).not.toHaveTextContent('without a partner');
    });
  });

  describe('the participants', () => {
    it('removes a participant', async () => {
      renderDraft(PEOPLE);
      await loaded();

      await userEvent.click(screen.getByRole('button', { name: 'Remove Bruno' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(savedContent().participants?.map((p) => p.displayName)).toEqual(['Ana']);
    });

    it('pairs two participants as partners', async () => {
      renderDraft(PEOPLE);
      await loaded();

      await userEvent.selectOptions(screen.getByLabelText('Partner of Ana'), 'p2');
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      const ps = savedContent().participants ?? [];
      expect(ps.find((p) => p.id === 'p1')?.partnerId).toBe('p2');
      expect(ps.find((p) => p.id === 'p2')?.partnerId).toBe('p1'); // reciprocal
    });

    it('marks who still needs a partner, when couples cook together', async () => {
      renderDraft(PEOPLE);
      await loaded();

      // Neither is paired, and the draft is one where couples cook together.
      expect(screen.getAllByText('needs a partner')).toHaveLength(2);
      // Said in both places on purpose: on the checklist, and in the panel where the
      // host sees it without scrolling.
      expect(screen.getAllByText(/2 participants without a partner/)).toHaveLength(2);

      await userEvent.selectOptions(screen.getByLabelText('Partner of Ana'), 'p2');

      expect(screen.queryByText('needs a partner')).not.toBeInTheDocument();
    });

    it('does not mark anybody as wanting a partner under the other formats', async () => {
      renderDraft(RULES);
      await loaded();
      await userEvent.click(
        screen.getByRole('radio', { name: 'Everyone on their own, partners kept apart' }),
      );
      await goTo('Participants & pairing');

      // Having no partner is a choice under this format, not a fault, so it is
      // neither marked on the row nor counted as something still missing.
      expect(await screen.findByLabelText('Partner of Ana')).toBeInTheDocument();
      expect(screen.queryByText('needs a partner')).not.toBeInTheDocument();
      expect(screen.queryByText(/without a partner/)).not.toBeInTheDocument();
    });

    /*
     * A partner recorded under a format that has no use for it is not a rule that
     * failed to apply — it is a roster fact, and throwing it away would lose work
     * the host did. Changing the format away and back has to leave it intact.
     */
    it('keeps a pairing through a change of format', async () => {
      renderDraft(PEOPLE);
      await loaded();
      await userEvent.selectOptions(screen.getByLabelText('Partner of Ana'), 'p2');

      await goTo('Rules');
      await userEvent.click(await screen.findByRole('radio', { name: 'Everyone on their own' }));
      await userEvent.click(screen.getByRole('radio', { name: 'Couples cook together' }));
      await goTo('Participants & pairing');

      expect(await screen.findByLabelText('Partner of Ana')).toHaveValue('p2');
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      const ps = savedContent().participants ?? [];
      expect(ps.find((p) => p.id === 'p1')?.partnerId).toBe('p2');
      expect(ps.find((p) => p.id === 'p2')?.partnerId).toBe('p1');
    });

    it('counts couples only where couples mean something', async () => {
      renderDraft(PEOPLE);
      await loaded();
      expect(screen.getByText('2 people · 0 couples')).toBeInTheDocument();

      await goTo('Rules');
      await userEvent.click(await screen.findByRole('radio', { name: 'Everyone on their own' }));
      await goTo('Participants & pairing');

      // "0 couples" under a format that pairs nobody is a fact about a rule the
      // contest does not have.
      expect(await screen.findByText('2 people')).toBeInTheDocument();
      expect(screen.queryByText(/couples/)).not.toBeInTheDocument();
    });

    it('offers nowhere to bar a pair by hand', async () => {
      renderDraft(PEOPLE);
      await loaded();

      // A partner is the only way two people are kept apart now.
      expect(screen.queryByRole('button', { name: 'Bar this pair' })).not.toBeInTheDocument();
      expect(screen.queryByText(/Can’t score each other/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Not in force for this contest/)).not.toBeInTheDocument();
    });
  });

  describe('the workspace around them', () => {
    it('shows a not-found state for a draft that isn’t the host’s', async () => {
      vi.mocked(api.getDraft).mockRejectedValue(new ApiError(404, 'DRAFT_NOT_FOUND'));
      renderDraft(RULES);

      expect(await screen.findByRole('heading', { name: 'Draft not found' })).toBeInTheDocument();
    });

    it.each([
      ['the rules', RULES],
      ['the participants', PEOPLE],
    ])('has no accessibility violations on %s', async (_name, at) => {
      const { container } = renderDraft(at);
      await loaded();
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
