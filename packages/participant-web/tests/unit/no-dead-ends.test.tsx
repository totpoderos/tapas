import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Score } from '../../src/pages/score';
import { Reveal } from '../../src/pages/reveal';
import type { Ballot } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual =
    await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, getBallot: vi.fn(), getMyScores: vi.fn(), getReveal: vi.fn(), sendVote: vi.fn() };
});
import * as api from '../../src/api/client';
import { i18n } from '../../src/i18n';

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
const waysOnward = () => screen.getByRole('navigation', { name: 'Go to' });

/**
 * A participant could get stuck: the scoring and results screens carried no
 * links at all, so anyone who arrived by the back button, a reload, or a typed
 * address had only the browser's own controls to escape with. Worse, coming back
 * to scoring after voting re-offered the ballot as though nothing had been sent,
 * because the screen kept that in memory rather than asking.
 */
describe('a participant is never stranded', () => {
  beforeEach(() => {
    stubLocalStorage('c1');
    vi.mocked(api.getBallot).mockReset().mockResolvedValue(BALLOT);
    vi.mocked(api.getMyScores).mockReset();
    vi.mocked(api.getReveal).mockReset();
    vi.mocked(api.sendVote).mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  describe('the scoring screen', () => {
    it('offers every step while the vote is still a draft', async () => {
      vi.mocked(api.getMyScores).mockResolvedValue({ scores: [], status: 'draft' });
      wrap(<Score />);

      const nav = await screen.findByRole('navigation', { name: 'Go to' });
      expect(within(nav).getByRole('link', { name: 'Dishes' })).toBeInTheDocument();
      expect(within(nav).getByRole('link', { name: 'Results' })).toBeInTheDocument();
    });

    /*
     * The bar offers the step you are on as well as the other two, and says so.
     * The links used to hide the current step, which meant the row of choices
     * changed shape as you moved and "you are here" was said only by absence.
     */
    it('marks the step the participant is on, and not by colour', async () => {
      vi.mocked(api.getMyScores).mockResolvedValue({ scores: [], status: 'draft' });
      wrap(<Score />);

      const nav = await screen.findByRole('navigation', { name: 'Go to' });
      const here = within(nav).getByRole('link', { current: 'page' });
      expect(here).toHaveTextContent('Score');
      // And only one step claims it.
      expect(within(nav).getAllByRole('link', { current: 'page' })).toHaveLength(1);
    });

    it('offers them just the same once the vote has been sent', async () => {
      vi.mocked(api.getMyScores).mockResolvedValue({ scores: [], status: 'sent' });
      wrap(<Score />);

      const nav = await screen.findByRole('navigation', { name: 'Go to' });
      expect(within(nav).getByRole('link', { name: 'Results' })).toBeInTheDocument();
      expect(within(nav).getByRole('link', { name: 'Dishes' })).toBeInTheDocument();
    });
  });

  describe('the results screen', () => {
    // Where a participant spends longest, and where there was nothing at all.
    it('offers a way onward even while waiting for the reveal', async () => {
      vi.mocked(api.getReveal).mockResolvedValue(null); // not revealed yet
      wrap(<Reveal />);

      expect(await screen.findByText(/almost there/i)).toBeInTheDocument();
      const nav = waysOnward();
      expect(within(nav).getByRole('link', { name: /Score/ })).toBeInTheDocument();
      expect(within(nav).getByRole('link', { name: 'Dishes' })).toBeInTheDocument();
    });

    // The English defaults in the bar mean a missing key is invisible in
    // English. Spanish is the case with teeth — the same lesson as the shared
    // reveal view, where only the Spanish assertion caught a missing resource.
    it('is translated, not falling back to the English defaults', async () => {
      await i18n.changeLanguage('es');
      try {
        vi.mocked(api.getReveal).mockResolvedValue(null);
        wrap(<Reveal />);

        const nav = await screen.findByRole('navigation', { name: 'Ir a' });
        expect(within(nav).getByRole('link', { name: /Puntuar/ })).toBeInTheDocument();
        expect(within(nav).getByRole('link', { name: 'Platos' })).toBeInTheDocument();
      } finally {
        // In a `finally`, because a failure here used to leak Spanish into every
        // test after it and report five failures for one defect.
        await i18n.changeLanguage('en');
      }
    });

    it('has no accessibility violations while waiting', async () => {
      vi.mocked(api.getReveal).mockResolvedValue(null);
      const { container } = wrap(<Reveal />);
      await screen.findByRole('navigation', { name: 'Go to' });
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});

/**
 * The vote's state comes from the server, not from what this screen remembers —
 * which is what makes it survive a reload or a step back.
 */
describe('a vote that is already in', () => {
  beforeEach(() => {
    stubLocalStorage('c1');
    vi.mocked(api.getBallot).mockReset().mockResolvedValue(BALLOT);
    vi.mocked(api.getMyScores).mockReset();
    vi.mocked(api.sendVote).mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it('reads as sent, and shows the scores that were given', async () => {
    vi.mocked(api.getMyScores).mockResolvedValue({
      scores: [{ dishId: 'D-b', categoryId: 'taste', value: 4 }],
      status: 'sent',
    });
    const { container } = wrap(<Score />);

    expect(await screen.findByRole('heading', { name: /vote sent/i })).toBeInTheDocument();
    expect(screen.getByText('Tortilla')).toBeInTheDocument();
    // A row per dish, with the category named — the score is a record now, and
    // a bare "4" outside the ballot's own columns says nothing on its own.
    expect(screen.getByText('Taste 4')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('offers nothing to change or to send again', async () => {
    vi.mocked(api.getMyScores).mockResolvedValue({
      scores: [{ dishId: 'D-b', categoryId: 'taste', value: 4 }],
      status: 'sent',
    });
    wrap(<Score />);
    await screen.findByRole('navigation', { name: 'Go to' });

    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /rank|score/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(api.sendVote).not.toHaveBeenCalled();
  });

  it('still lets a draft vote be scored and sent', async () => {
    vi.mocked(api.getMyScores).mockResolvedValue({ scores: [], status: 'draft' });
    wrap(<Score />);

    // `/score` is the ballot now — every dish and the way to send — rather than
    // a page of every control at once.
    expect(await screen.findByRole('heading', { name: /your ballot/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  // The regression that started this: the answer must not live in memory.
  it('still reads as sent when the screen is opened afresh', async () => {
    vi.mocked(api.getMyScores).mockResolvedValue({
      scores: [{ dishId: 'D-b', categoryId: 'taste', value: 4 }],
      status: 'sent',
    });
    const first = wrap(<Score />);
    await screen.findByRole('navigation', { name: 'Go to' });
    first.unmount();

    wrap(<Score />); // as if arrived by the back button, or reloaded
    await screen.findByRole('navigation', { name: 'Go to' });
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument();
  });
});
