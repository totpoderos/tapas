import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Score } from '../../src/pages/score';
import { YourDish } from '../../src/pages/your-dish';
import { ApiError, type Ballot, type Identity } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual =
    await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return {
    ...actual,
    getBallot: vi.fn(),
    getMyScores: vi.fn(),
    saveScore: vi.fn(),
    sendVote: vi.fn(),
    getDishes: vi.fn(),
    submitDish: vi.fn(),
  };
});
import * as api from '../../src/api/client';

/** What the API answers once the session is gone — expired, or never kept at all. */
const signedOut = () => new ApiError(401, 'NOT_SIGNED_IN', 'Sign in required.');
/** Anything else that can go wrong saving a dish. */
const brokeSomehow = () => new ApiError(500, 'OOPS', 'Something went wrong.');

const IDENTITY: Identity = { participantId: 'ana', contestId: 'c1', displayName: 'Ana' };

const BALLOT: Ballot = {
  contestId: 'c1',
  categories: [{ id: 'taste', name: 'Taste' }],
  range: { min: 1, max: 5 },
  uniquePerCategory: false,
  dishes: [{ dishId: 'D-b', name: 'Tortilla' }],
};

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
 * The Safari defect surfaced as "Your dish couldn't be saved. Please try again."
 * — an invitation to retry something that could never succeed, because the
 * session had not been kept. The cookie fix removes the common cause, but a
 * voter session is a remember-me token with a finite life, so this can still
 * happen honestly. Either way the participant deserves the truth and a way back.
 */
describe('when the participant is no longer signed in', () => {
  beforeEach(() => {
    stubLocalStorage('c1');
    for (const fn of [
      api.getBallot,
      api.getMyScores,
      api.sendVote,
      api.getDishes,
      api.submitDish,
    ] as const) {
      vi.mocked(fn).mockReset();
    }
  });
  afterEach(() => vi.clearAllMocks());

  it('tells a cook their session ended instead of inviting a pointless retry', async () => {
    vi.mocked(api.getDishes).mockResolvedValue([]);
    vi.mocked(api.submitDish).mockRejectedValue(signedOut());
    const { container } = wrap(<YourDish identity={IDENTITY} />);

    await userEvent.type(await screen.findByLabelText(/dish/i), 'Patatas bravas');
    await userEvent.click(screen.getByRole('button', { name: 'Submit dish' }));

    // One title for this one state, wherever a participant meets it — the dish
    // screen, scoring, and the results all now say the same thing.
    expect(
      await screen.findByRole('heading', { name: 'Join first' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/try again/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to join/i })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  // The branch must not swallow real failures — that would trade one misleading
  // message for another.
  it('still reports a genuine save failure as one, with a retry that makes sense', async () => {
    vi.mocked(api.getDishes).mockResolvedValue([]);
    vi.mocked(api.submitDish).mockRejectedValue(brokeSomehow());
    wrap(<YourDish identity={IDENTITY} />);

    await userEvent.type(await screen.findByLabelText(/dish/i), 'Patatas bravas');
    await userEvent.click(screen.getByRole('button', { name: 'Submit dish' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t be saved/i);
    expect(
      screen.queryByRole('heading', { name: 'Join first' }),
    ).not.toBeInTheDocument();
  });

  it('sends a scorer back to joining rather than showing a loading failure', async () => {
    vi.mocked(api.getBallot).mockRejectedValue(signedOut());
    vi.mocked(api.getMyScores).mockRejectedValue(signedOut());
    const { container } = wrap(<Score />);

    expect(await screen.findByRole('heading', { name: 'Join first' })).toBeInTheDocument();
    expect(screen.queryByText(/couldn’t be loaded/i)).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('stops offering to send a vote once the session is gone', async () => {
    vi.mocked(api.getBallot).mockResolvedValue(BALLOT);
    vi.mocked(api.getMyScores).mockResolvedValue({
      scores: [{ dishId: 'D-b', categoryId: 'taste', value: 4 }],
      status: 'draft',
    });
    vi.mocked(api.sendVote).mockRejectedValue(signedOut());
    wrap(<Score />);

    await userEvent.click(await screen.findByRole('button', { name: /send/i }));
    await userEvent.click(await screen.findByRole('button', { name: /send my vote|yes|confirm/i }));

    expect(await screen.findByRole('heading', { name: 'Join first' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument();
  });

  it('still reports a genuine send failure as one', async () => {
    vi.mocked(api.getBallot).mockResolvedValue(BALLOT);
    vi.mocked(api.getMyScores).mockResolvedValue({
      scores: [{ dishId: 'D-b', categoryId: 'taste', value: 4 }],
      status: 'draft',
    });
    vi.mocked(api.sendVote).mockRejectedValue(brokeSomehow());
    wrap(<Score />);

    await userEvent.click(await screen.findByRole('button', { name: /send/i }));
    await userEvent.click(await screen.findByRole('button', { name: /send my vote|yes|confirm/i }));

    expect(
      screen.queryByRole('heading', { name: 'Join first' }),
    ).not.toBeInTheDocument();
  });
});
