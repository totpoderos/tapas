import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Reveal } from '../../src/pages/reveal';
import type { Reveal as RevealData, Turnout } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, getReveal: vi.fn(), getTurnout: vi.fn() };
});
import * as api from '../../src/api/client';

const REVEAL: RevealData = {
  contestName: 'Summer Tapas',
  overall: {
    winners: [{ dishId: 'D-b', name: 'Tortilla' }],
    standings: [
      { dishId: 'D-b', name: 'Tortilla', total: 8 },
      { dishId: 'D-c', name: 'Gazpacho', total: 5 },
      { dishId: 'D-a', name: 'Patatas', total: 3 },
    ],
  },
  categories: [
    { categoryId: 'taste', name: 'Taste', winners: [{ dishId: 'D-b', name: 'Tortilla' }], standings: [] },
    { categoryId: 'look', name: 'Presentation', winners: [{ dishId: 'D-c', name: 'Gazpacho' }], standings: [] },
  ],
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

const renderReveal = () =>
  render(
    <MemoryRouter initialEntries={['/reveal']}>
      <Reveal />
    </MemoryRouter>,
  );

describe('Reveal screen', () => {
  beforeEach(() => {
    stubLocalStorage('c1');
    vi.mocked(api.getReveal).mockReset();
    // Nothing to say about the voting by default — the waiting screen has to
    // stand up without it, so that is the shape most of these tests see.
    vi.mocked(api.getTurnout).mockReset().mockResolvedValue(null);
  });
  afterEach(() => vi.clearAllMocks());

  /**
   * The winning dish's name, which also appears further down the leaderboard, so
   * it has to be disambiguated. It is the h1 since the restyle — which is itself
   * the promise this screen makes: the dish that won is the headline, and what a
   * screen-reader user hears first.
   */
  const findWinnerLine = async (): Promise<HTMLElement> => {
    // Wait for the reveal itself to arrive first: while the screen is still
    // waiting, the only h1 is "Almost there…", and a bare h1 query would race it.
    await screen.findByRole('region', { name: 'Leaderboard' });
    return screen.getByRole('heading', { level: 1 });
  };

  it('waits while the contest is not revealed yet', async () => {
    vi.mocked(api.getReveal).mockResolvedValue(null);
    renderReveal();
    expect(await screen.findByText(/almost there/i)).toBeInTheDocument();
  });

  it('shows the overall winner and each category’s winner once revealed', async () => {
    vi.mocked(api.getReveal).mockResolvedValue(REVEAL);
    renderReveal();

    expect(await findWinnerLine()).toHaveTextContent('Tortilla');
    const cats = screen.getByRole('region', { name: 'Category winners' });
    expect(within(cats).getByText('Presentation')).toBeInTheDocument();
    expect(within(cats).getByText('Gazpacho')).toBeInTheDocument();
  });

  it('shows the leaderboard highest first', async () => {
    vi.mocked(api.getReveal).mockResolvedValue(REVEAL);
    renderReveal();
    const board = await screen.findByRole('region', { name: 'Leaderboard' });
    const rows = within(board).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Tortilla');
    expect(rows[2]).toHaveTextContent('Patatas');
  });

  /*
   * Screen 12: the dish is the headline and the cook is named beneath it, so
   * the result names a person as well as a plate. The host's screen leads with
   * the word "Winner" instead — the two drawings are allowed to differ, and
   * what may not is which dish won.
   */
  it('names the cook beneath the winning dish', async () => {
    vi.mocked(api.getReveal).mockResolvedValue({
      ...REVEAL,
      overall: {
        winners: [{ dishId: 'D-b', name: 'Tortilla', cooks: ['Iván'] }],
        standings: REVEAL.overall.standings,
      },
    });
    renderReveal();

    expect(await findWinnerLine()).toHaveTextContent('Tortilla');
    expect(screen.getByText('brought by Iván')).toBeInTheDocument();
  });

  it('names both cooks of a dish two people brought', async () => {
    vi.mocked(api.getReveal).mockResolvedValue({
      ...REVEAL,
      overall: {
        winners: [{ dishId: 'D-b', name: 'Tortilla', cooks: ['Iván', 'Nuria'] }],
        standings: REVEAL.overall.standings,
      },
    });
    renderReveal();
    await findWinnerLine();

    expect(screen.getByText('brought by Iván & Nuria')).toBeInTheDocument();
  });

  it('draws the winner without a cook line when nobody is named', async () => {
    // The field is optional: a result from before it existed is still a result,
    // and the dish — which is what the promise is about — is drawn regardless.
    vi.mocked(api.getReveal).mockResolvedValue(REVEAL); // no `cooks` on its winners
    renderReveal();

    expect(await findWinnerLine()).toHaveTextContent('Tortilla');
    expect(screen.queryByText(/brought by/i)).not.toBeInTheDocument();
  });

  it('renders joint winners on a tie', async () => {
    vi.mocked(api.getReveal).mockResolvedValue({
      ...REVEAL,
      overall: {
        winners: [
          { dishId: 'D-a', name: 'Patatas' },
          { dishId: 'D-b', name: 'Tortilla' },
        ],
        standings: REVEAL.overall.standings,
      },
    });
    renderReveal();
    expect(await screen.findByText('Joint winners')).toBeInTheDocument();
    expect(screen.getByText(/Patatas & Tortilla/)).toBeInTheDocument();
  });

  it('prompts to join when this device has no contest', async () => {
    stubLocalStorage(null);
    renderReveal();
    expect(await screen.findByRole('heading', { name: 'Join first' })).toBeInTheDocument();
    expect(api.getReveal).not.toHaveBeenCalled();
  });

  it('has no accessibility violations on the revealed screen', async () => {
    vi.mocked(api.getReveal).mockResolvedValue(REVEAL);
    const { container } = renderReveal();
    await findWinnerLine();
    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * Screen 11. Waiting is where a participant stands longest, and it used to be
 * the emptiest screen in the app: an animated dot and two lines. It now says how
 * the voting stands — but only ever as an addition, which is what the last two
 * tests here are for.
 */
const TURNOUT: Turnout = {
  votesIn: 2,
  votesExpected: 4,
  participants: [
    { participantId: 'ana', displayName: 'Ana', sent: true },
    { participantId: 'bruno', displayName: 'Bruno', sent: true },
    { participantId: 'carmen', displayName: 'Carmen', sent: false },
    { participantId: 'diego', displayName: 'Diego', sent: false },
  ],
};

describe('Waiting for the reveal', () => {
  beforeEach(() => {
    stubLocalStorage('c1');
    vi.mocked(api.getReveal).mockReset().mockResolvedValue(null); // not revealed
    vi.mocked(api.getTurnout).mockReset().mockResolvedValue(TURNOUT);
  });
  afterEach(() => vi.clearAllMocks());

  it('says how many votes are in, out of how many are expected', async () => {
    renderReveal();
    expect(await screen.findByText('2 of 4 votes in')).toBeInTheDocument();
  });

  it('names who has still to vote, in words and not by colour alone', async () => {
    renderReveal();
    const roster = await screen.findByRole('list', { name: 'Who has voted' });

    const carmen = within(roster).getByText('Carmen').closest('li');
    expect(carmen).toHaveTextContent('still voting');
    const ana = within(roster).getByText('Ana').closest('li');
    expect(ana).toHaveTextContent('in');
  });

  /*
   * The disclosure boundary as the screen sees it: the roster says whether a
   * vote is in and nothing more. Nothing here should hint at how far anyone has
   * got, because the read it draws from does not carry that.
   */
  it('says nothing about how far anyone has got', async () => {
    renderReveal();
    const roster = await screen.findByRole('list', { name: 'Who has voted' });
    expect(roster.textContent).not.toMatch(/scored|of \d|dish|started|progress/i);
  });

  it('still says the results are being waited for when the standing is unavailable', async () => {
    vi.mocked(api.getTurnout).mockResolvedValue(null);
    renderReveal();

    // The whole point: the screen that was there before is still there.
    expect(await screen.findByText(/almost there/i)).toBeInTheDocument();
    expect(screen.getByText(/the moment the host reveals/i)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Who has voted' })).not.toBeInTheDocument();
    // And it is still not a dead end.
    expect(screen.getByRole('navigation', { name: 'Go to' })).toBeInTheDocument();
  });

  it('stops asking how the voting stands once the results are out', async () => {
    vi.mocked(api.getReveal).mockResolvedValue(REVEAL);
    renderReveal();
    await screen.findByRole('heading', { level: 1, name: 'Tortilla' });

    // Who was still voting is a question about a moment that has passed.
    expect(screen.queryByRole('list', { name: 'Who has voted' })).not.toBeInTheDocument();
  });

  it('has no accessibility violations while waiting', async () => {
    const { container } = renderReveal();
    await screen.findByRole('list', { name: 'Who has voted' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
