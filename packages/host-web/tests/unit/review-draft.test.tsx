import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewDraft } from '../../src/pages/review-draft';
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
    attribution: 'per_couple',
    antiBias: 'couples',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'fixed', min: 1, max: 5 }, uniquePerCategory: true },
    participants: [
      { id: 'p1', displayName: 'Ana' },
      { id: 'p2', displayName: 'Bruno' },
    ],
  },
};

function renderReview() {
  return render(
    <MemoryRouter initialEntries={['/review/d1']}>
      <ContestsProvider>
        <WithPanelSlots>
          <Routes>
          <Route path="/review/:id" element={<ReviewDraft />} />
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

/** The content passed to the latest updateDraft call. */
function savedContent(): DraftContent {
  const calls = vi.mocked(api.updateDraft).mock.calls;
  return calls[calls.length - 1]![1];
}

describe('Edit draft', () => {
  beforeEach(() => {
    vi.mocked(api.listContests).mockReset().mockResolvedValue([]);
    vi.mocked(api.getDraft).mockReset().mockResolvedValue(DRAFT);
    vi.mocked(api.publishDraft).mockReset().mockResolvedValue('c1');
    vi.mocked(api.updateDraft).mockReset().mockResolvedValue();
  });
  afterEach(() => vi.clearAllMocks());

  it('loads the draft into editable fields', async () => {
    renderReview();

    expect(await screen.findByRole('heading', { name: /Edit .Summer Tapas./ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Each couple is scored together' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Couples cannot score each other' })).toBeChecked();
    expect(screen.getByRole('list', { name: 'Scoring categories' })).toHaveTextContent('Taste');
    expect(screen.getByLabelText('Participant 1 name')).toHaveValue('Ana');
    expect(screen.getByLabelText('Participant 2 name')).toHaveValue('Bruno');
  });

  it('saves changes to the rules', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    await userEvent.click(screen.getByRole('radio', { name: 'Each person is scored on their own' }));
    await userEvent.click(screen.getByRole('radio', { name: 'No restriction' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(api.updateDraft).toHaveBeenCalledWith('d1', expect.anything());
    expect(savedContent().attribution).toBe('per_person');
    expect(savedContent().antiBias).toBe('none');
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('removes a participant', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    await userEvent.click(screen.getByRole('button', { name: 'Remove Bruno' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(savedContent().participants?.map((p) => p.displayName)).toEqual(['Ana']);
  });

  it('pairs two participants as a couple', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    await userEvent.selectOptions(screen.getByLabelText('Partner of Ana'), 'p2');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const ps = savedContent().participants ?? [];
    expect(ps.find((p) => p.id === 'p1')?.partnerId).toBe('p2');
    expect(ps.find((p) => p.id === 'p2')?.partnerId).toBe('p1'); // reciprocal
  });

  it('requires a name to save', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    await userEvent.clear(screen.getByLabelText('Contest name'));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(api.updateDraft).not.toHaveBeenCalled();
    expect(screen.getByText('A name is required.')).toBeInTheDocument();
  });

  it('publishes the draft and lands in its control room', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    await userEvent.click(screen.getByRole('button', { name: /Publish/ }));

    expect(api.publishDraft).toHaveBeenCalledWith('d1');
    // Where the join code is, which is what a host needs the moment it goes live.
    expect(await screen.findByRole('heading', { name: 'Control room' })).toBeInTheDocument();
  });


  /*
   * The rule is offered as "chosen pairs cannot score each other" and used to write
   * one direction only, so barring Núria from scoring Pau left Pau free to score
   * Núria. Pairing on this same screen was already reciprocal; barring is now too.
   */
  it('bars a pair from scoring each other, both ways', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    await userEvent.selectOptions(screen.getByLabelText('One'), 'p1');
    await userEvent.selectOptions(screen.getByLabelText('The other'), 'p2');
    await userEvent.click(screen.getByRole('button', { name: 'Bar this pair' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const ps = savedContent().participants ?? [];
    expect(ps.find((p) => p.id === 'p1')?.noScoreWith).toEqual(['p2']);
    expect(ps.find((p) => p.id === 'p2')?.noScoreWith).toEqual(['p1']);
  });

  it('lists a barred pair once, not once per person', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    await userEvent.selectOptions(screen.getByLabelText('One'), 'p1');
    await userEvent.selectOptions(screen.getByLabelText('The other'), 'p2');
    await userEvent.click(screen.getByRole('button', { name: 'Bar this pair' }));

    const pairs = screen.getByRole('list', { name: 'Can’t score each other' });
    expect(within(pairs).getAllByRole('listitem')).toHaveLength(1);
  });

  it('lifts a bar from both sides', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    await userEvent.selectOptions(screen.getByLabelText('One'), 'p1');
    await userEvent.selectOptions(screen.getByLabelText('The other'), 'p2');
    await userEvent.click(screen.getByRole('button', { name: 'Bar this pair' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Let Ana and Bruno score each other again' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const ps = savedContent().participants ?? [];
    expect(ps.find((p) => p.id === 'p1')?.noScoreWith ?? []).toEqual([]);
    expect(ps.find((p) => p.id === 'p2')?.noScoreWith ?? []).toEqual([]);
  });

  it('shows a half-bar left by an older draft as the pair it was meant to be', async () => {
    // One direction only, the way this screen used to write it.
    vi.mocked(api.getDraft).mockResolvedValue({
      ...DRAFT,
      content: {
        ...DRAFT.content,
        participants: [
          { id: 'p1', displayName: 'Ana', noScoreWith: ['p2'] },
          { id: 'p2', displayName: 'Bruno' },
        ],
      },
    });
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    const pairs = screen.getByRole('list', { name: 'Can’t score each other' });
    expect(within(pairs).getAllByRole('listitem')).toHaveLength(1);

    // And saving makes it mutual for good.
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const ps = savedContent().participants ?? [];
    expect(ps.find((p) => p.id === 'p2')?.noScoreWith).toEqual(['p1']);
  });

  it('marks who still needs a partner, when scoring is per couple', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    // Neither is paired, and the draft is scored per couple.
    expect(screen.getAllByText('needs a partner')).toHaveLength(2);
    // Said in both places on purpose: on the checklist, and in the panel where the
    // host sees it without scrolling.
    expect(screen.getAllByText(/2 participants without a partner/)).toHaveLength(2);

    await userEvent.selectOptions(screen.getByLabelText('Partner of Ana'), 'p2');

    expect(screen.queryByText('needs a partner')).not.toBeInTheDocument();
  });

  it('does not ask about pairing when each person is scored on their own', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    await userEvent.click(screen.getByRole('radio', { name: 'Each person is scored on their own' }));

    // Pairing is beside the point, so nobody is short of anything.
    expect(screen.queryByText('needs a partner')).not.toBeInTheDocument();
    expect(screen.queryByText(/without a partner/)).not.toBeInTheDocument();
  });

  it('says what is ready and what is not before publishing', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    const checklist = screen.getByRole('region', { name: 'Publish checklist' });
    expect(checklist).toHaveTextContent('Name set');
    expect(checklist).toHaveTextContent('1 scoring category');
    expect(checklist).toHaveTextContent('Score range fixed 1–5');
    expect(checklist).toHaveTextContent('2 participants without a partner');
  });

  it('says everything is in place once nothing is missing', async () => {
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    await userEvent.selectOptions(screen.getByLabelText('Partner of Ana'), 'p2');

    const checklist = screen.getByRole('region', { name: 'Publish checklist' });
    expect(checklist).toHaveTextContent('Everything needed is in place');
    expect(checklist).not.toHaveTextContent('without a partner');
  });

  it('announces the reason when a draft is too incomplete to publish', async () => {
    vi.mocked(api.publishDraft).mockRejectedValue(
      new ApiError(422, 'INCOMPLETE_DRAFT', 'The draft is missing its scoring rules.'),
    );
    renderReview();
    await screen.findByRole('heading', { name: /Edit/ });

    await userEvent.click(screen.getByRole('button', { name: /Publish/ }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/can.t go live yet/i);
    expect(alert).toHaveTextContent(/missing its scoring rules/i);
  });

  it('shows a not-found state for a draft that isn’t the host’s', async () => {
    vi.mocked(api.getDraft).mockRejectedValue(new ApiError(404, 'DRAFT_NOT_FOUND'));
    renderReview();

    expect(await screen.findByRole('heading', { name: 'Draft not found' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderReview();
    await screen.findByRole('heading', { name: /Edit/ });
    expect(await axe(container)).toHaveNoViolations();
  });
});
