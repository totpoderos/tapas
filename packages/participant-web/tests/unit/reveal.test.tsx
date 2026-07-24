import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Reveal } from '../../src/pages/reveal';
import type { Reveal as RevealData } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, getReveal: vi.fn() };
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
  });
  afterEach(() => vi.clearAllMocks());

  it('waits while the contest is not revealed yet', async () => {
    vi.mocked(api.getReveal).mockResolvedValue(null);
    renderReveal();
    expect(await screen.findByText(/almost there/i)).toBeInTheDocument();
  });

  it('shows the overall winner and each category’s winner once revealed', async () => {
    vi.mocked(api.getReveal).mockResolvedValue(REVEAL);
    renderReveal();

    expect(await screen.findByText('Tortilla', { selector: '.pt-reveal-winner' })).toBeInTheDocument();
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
    await screen.findByText('Tortilla', { selector: '.pt-reveal-winner' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
