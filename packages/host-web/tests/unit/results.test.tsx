import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Results } from '../../src/pages/results';
import { ApiError, type Reveal } from '../../src/api/client';
import '../../src/i18n';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual =
    await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, getWinners: vi.fn() };
});
import * as api from '../../src/api/client';

const REVEAL: Reveal = {
  contestName: 'Summer Tapas',
  overall: {
    winners: [{ dishId: 'D-bob', name: 'Tortilla' }],
    standings: [
      { dishId: 'D-bob', name: 'Tortilla', total: 9 },
      { dishId: 'D-ana', name: 'Patatas bravas', total: 5 },
      { dishId: 'D-cal', name: 'Gazpacho', total: 2 },
    ],
  },
  categories: [
    {
      categoryId: 'taste',
      name: 'Taste',
      winners: [{ dishId: 'D-bob', name: 'Tortilla' }],
      standings: [],
    },
    {
      categoryId: 'look',
      name: 'Presentation',
      winners: [{ dishId: 'D-cal', name: 'Gazpacho' }],
      standings: [],
    },
  ],
};

function renderResults() {
  return render(
    <MemoryRouter initialEntries={['/results/c1']}>
      <Routes>
        <Route path="/results/:id" element={<Results />} />
        <Route path="/contest/:id" element={<h1>Control room</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("The host's results screen", () => {
  beforeEach(() => {
    vi.mocked(api.getWinners).mockReset().mockResolvedValue(REVEAL);
  });
  afterEach(() => vi.clearAllMocks());

  it('shows the overall winner and each category’s winner', async () => {
    renderResults();

    const heading = await screen.findByRole('heading', { level: 1, name: 'Winner' });
    expect(heading.nextElementSibling).toHaveTextContent('Tortilla');

    const cats = screen.getByRole('region', { name: 'Category winners' });
    expect(within(cats).getByText('Presentation')).toBeInTheDocument();
    expect(within(cats).getByText('Gazpacho')).toBeInTheDocument();
  });

  it('shows the leaderboard highest first', async () => {
    renderResults();
    const board = await screen.findByRole('region', { name: 'Leaderboard' });
    const rows = within(board).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Tortilla');
    expect(rows[2]).toHaveTextContent('Gazpacho');
  });

  it('names both dishes on a tie rather than picking one', async () => {
    vi.mocked(api.getWinners).mockResolvedValue({
      ...REVEAL,
      overall: {
        winners: [
          { dishId: 'D-ana', name: 'Patatas bravas' },
          { dishId: 'D-bob', name: 'Tortilla' },
        ],
        standings: REVEAL.overall.standings,
      },
    });
    renderResults();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Joint winners' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Patatas bravas & Tortilla')).toBeInTheDocument();
  });

  // The API answers 409 before the reveal, which the client turns into `null`.
  // An empty result must never be dressed up as a result.
  it('says the results are not out yet rather than showing an empty reveal', async () => {
    vi.mocked(api.getWinners).mockResolvedValue(null);
    renderResults();

    expect(
      await screen.findByRole('heading', { name: 'The results aren’t out yet' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Leaderboard' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the contest' })).toBeInTheDocument();
  });

  it("says so when the contest is not the host's, without leaking that it exists", async () => {
    vi.mocked(api.getWinners).mockRejectedValue(new ApiError(403, 'NOT_ALLOWED'));
    renderResults();

    expect(await screen.findByRole('heading', { name: 'Contest not found' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Leaderboard' })).not.toBeInTheDocument();
  });

  it('reports a failure it cannot explain', async () => {
    vi.mocked(api.getWinners).mockRejectedValue(new Error('network'));
    renderResults();
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t be loaded/i);
  });

  it('has no accessibility violations on the revealed screen', async () => {
    const { container } = renderResults();
    await screen.findByRole('region', { name: 'Leaderboard' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations before the reveal', async () => {
    vi.mocked(api.getWinners).mockResolvedValue(null);
    const { container } = renderResults();
    await screen.findByRole('heading', { name: 'The results aren’t out yet' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
