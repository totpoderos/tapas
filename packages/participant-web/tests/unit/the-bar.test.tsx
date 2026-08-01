import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YourDish } from '../../src/pages/your-dish';
import { Score } from '../../src/pages/score';
import type { Ballot, Identity } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual =
    await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return {
    ...actual,
    getDishes: vi.fn(),
    submitDish: vi.fn(),
    getBallot: vi.fn(),
    getMyScores: vi.fn(),
  };
});
import * as api from '../../src/api/client';

const ANA: Identity = { participantId: 'a', contestId: 'c1', displayName: 'Ana' };

const BALLOT: Ballot = {
  contestId: 'c1',
  categories: [{ id: 'taste', name: 'Taste' }],
  range: { min: 1, max: 5 },
  uniquePerCategory: false,
  dishes: [{ dishId: 'D-b', name: 'Tortilla' }],
};
/** A contest where this participant has nothing of their own to score. */
const EMPTY_BALLOT: Ballot = { ...BALLOT, dishes: [] };

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

const bar = () => screen.findByRole('navigation', { name: 'Go to' });

/**
 * The ways onward, as a bar (handoff, implementation notes 1 and 2).
 *
 * These are the promises that are new with the bar rather than inherited from
 * the links it replaces: that every step is offered including the one you are
 * on, that the current one is marked by something other than its colour, and
 * that the scoring step reports how this participant's own vote stands.
 */
describe('the ways onward', () => {
  beforeEach(() => {
    stubLocalStorage('c1');
    vi.mocked(api.getDishes).mockReset().mockResolvedValue({ dishes: [], expected: 5 });
    vi.mocked(api.getBallot).mockReset().mockResolvedValue(BALLOT);
    vi.mocked(api.getMyScores).mockReset().mockResolvedValue({ scores: [], status: 'draft' });
  });
  afterEach(() => vi.clearAllMocks());

  const dishScreen = () =>
    render(
      <MemoryRouter>
        <YourDish identity={ANA} />
      </MemoryRouter>,
    );

  it('offers all three steps, wherever the participant is', async () => {
    dishScreen();

    const nav = await bar();
    expect(within(nav).getByRole('link', { name: 'Dishes' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /Score/ })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Results' })).toBeInTheDocument();
  });

  it('marks the step the participant is on, and not by colour alone', async () => {
    dishScreen();

    const nav = await bar();
    const here = within(nav).getByRole('link', { current: 'page' });
    expect(here).toHaveTextContent('Dishes');
  });

  describe('and how the vote stands', () => {
    it('says there is still something to send while dishes are open', async () => {
      dishScreen();

      const nav = await bar();
      expect(
        await within(nav).findByRole('link', { name: /^Score — still to send$/ }),
      ).toBeInTheDocument();
    });

    it('says the vote is already in once it has been sent', async () => {
      vi.mocked(api.getMyScores).mockResolvedValue({ scores: [], status: 'sent' });
      dishScreen();

      const nav = await bar();
      expect(
        await within(nav).findByRole('link', { name: /^Score — already sent$/ }),
      ).toBeInTheDocument();
    });

    /*
     * A contest of one dish, and it is this cook's own — so their ballot is
     * empty and there is nothing for them to do yet. Marking the step
     * outstanding here would send them to a screen with nothing on it.
     */
    it('says nothing at all when there is nothing to score', async () => {
      vi.mocked(api.getBallot).mockResolvedValue(EMPTY_BALLOT);
      dishScreen();

      const nav = await bar();
      expect(within(nav).getByRole('link', { name: 'Score' })).toBeInTheDocument();
    });

    /*
     * The mark is an addition to screens that were complete without it. A read
     * that fails must cost nothing — not an error, not a missing screen, not a
     * mark that says the wrong thing.
     */
    it('is simply not drawn when it cannot be read', async () => {
      vi.mocked(api.getBallot).mockRejectedValue(new Error('offline'));
      dishScreen();

      const nav = await bar();
      expect(within(nav).getByRole('link', { name: 'Score' })).toBeInTheDocument();
      // And the screen it sits under is untouched.
      expect(screen.getByRole('heading', { name: /Your dish/i })).toBeInTheDocument();
    });

    // Nobody else's business, and nothing here is anybody else's.
    it('tells on nobody', async () => {
      vi.mocked(api.getMyScores).mockResolvedValue({ scores: [], status: 'sent' });
      dishScreen();

      const nav = await bar();
      expect(within(nav).getAllByRole('link')).toHaveLength(3);
      expect(nav).not.toHaveTextContent(/Bruno|Carmen/);
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = dishScreen();
    await bar();
    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * The screens that carry no bar. Both are dead ends reached through no fault of
 * the participant's, and on both the only operable thing is the way out — a bar
 * offering three steps that will all refuse them is three more disappointments.
 */
describe('a screen with nowhere to go', () => {
  beforeEach(() => {
    stubLocalStorage(null);
    vi.mocked(api.getBallot).mockReset();
    vi.mocked(api.getMyScores).mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it('offers no ways onward, only the way out', async () => {
    render(
      <MemoryRouter>
        <Score />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /join first/i })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Go to' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
