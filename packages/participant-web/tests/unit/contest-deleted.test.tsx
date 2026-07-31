import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Reveal } from '../../src/pages/reveal';
import { Score } from '../../src/pages/score';
import { YourDish } from '../../src/pages/your-dish';
import { ApiError, type Ballot, type Identity } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual =
    await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return {
    ...actual,
    getReveal: vi.fn(),
    getBallot: vi.fn(),
    getMyScores: vi.fn(),
    sendVote: vi.fn(),
    saveScore: vi.fn(),
    getDishes: vi.fn(),
    submitDish: vi.fn(),
  };
});
import * as api from '../../src/api/client';

/** What the API answers on a voter-scoped route once the host has deleted it. */
const deleted = () => new ApiError(410, 'CONTEST_DELETED', 'The host deleted this contest.');

const BALLOT: Ballot = {
  contestId: 'c1',
  categories: [{ id: 'taste', name: 'Taste' }],
  range: { min: 1, max: 5 },
  uniquePerCategory: false,
  dishes: [{ dishId: 'D-b', name: 'Tortilla' }],
};

const IDENTITY: Identity = { participantId: 'ana', contestId: 'c1', displayName: 'Ana' };

function stubLocalStorage(contestId: string | null) {
  const store = new Map<string, string>();
  if (contestId) store.set('tapas.contestId', contestId);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
}

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

/**
 * The host can delete a contest at any moment, including while someone is in the
 * middle of using it. Every screen that follows a live contest has to say so
 * plainly — not show a generic failure, an empty list, or wait forever.
 */
describe('when the host deletes the contest underneath a participant', () => {
  beforeEach(() => {
    stubLocalStorage('c1');
    vi.mocked(api.getReveal).mockReset();
    vi.mocked(api.getBallot).mockReset();
    vi.mocked(api.getMyScores).mockReset();
    vi.mocked(api.sendVote).mockReset();
    vi.mocked(api.getDishes).mockReset();
    vi.mocked(api.submitDish).mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it('tells someone waiting for the results, instead of waiting forever', async () => {
    vi.mocked(api.getReveal).mockRejectedValue(deleted());
    const { container } = wrap(<Reveal />);

    expect(await screen.findByRole('heading', { name: 'This contest is gone' })).toBeInTheDocument();
    expect(screen.queryByText(/almost there/i)).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('stops polling once it knows the contest is gone', async () => {
    vi.mocked(api.getReveal).mockRejectedValue(deleted());
    wrap(<Reveal />);
    await screen.findByRole('heading', { name: 'This contest is gone' });

    const callsWhenTold = vi.mocked(api.getReveal).mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 2500)); // longer than the poll interval
    expect(vi.mocked(api.getReveal).mock.calls.length).toBe(callsWhenTold);
  }, 10_000);

  it('tells someone scoring, rather than showing a generic failure', async () => {
    vi.mocked(api.getBallot).mockRejectedValue(deleted());
    vi.mocked(api.getMyScores).mockRejectedValue(deleted());
    const { container } = wrap(<Score />);

    expect(await screen.findByRole('heading', { name: 'This contest is gone' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('leaves the form behind when the vote is sent into a deleted contest', async () => {
    vi.mocked(api.getBallot).mockResolvedValue(BALLOT);
    vi.mocked(api.getMyScores).mockResolvedValue({
      scores: [{ dishId: 'D-b', categoryId: 'taste', value: 4 }],
      status: 'draft',
    });
    vi.mocked(api.sendVote).mockRejectedValue(deleted());
    wrap(<Score />);

    await userEvent.click(await screen.findByRole('button', { name: /send/i }));
    // The send goes through a confirmation sheet, so accept it there. The
    // trigger stays on the ballot behind it — hidden from assistive technology
    // by `aria-modal`, but still matched by a query that does not say where it
    // is looking.
    const sheet = await screen.findByRole('dialog');
    await userEvent.click(within(sheet).getByRole('button', { name: /yes, send/i }));

    expect(await screen.findByRole('heading', { name: 'This contest is gone' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument();
  });

  it('tells someone entering a dish, rather than showing an empty list', async () => {
    vi.mocked(api.getDishes).mockRejectedValue(deleted());
    const { container } = wrap(<YourDish identity={IDENTITY} />);

    expect(await screen.findByRole('heading', { name: 'This contest is gone' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
