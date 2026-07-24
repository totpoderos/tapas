import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Score } from '../../src/pages/score';
import type { Ballot } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, getBallot: vi.fn(), getMyScores: vi.fn(), saveScore: vi.fn(), sendVote: vi.fn() };
});
import * as api from '../../src/api/client';

const BALLOT: Ballot = {
  contestId: 'c1',
  dishes: [
    { dishId: 'D-C', name: 'Tortilla' },
    { dishId: 'D-D', name: 'Gazpacho' },
  ],
  categories: [{ id: 'cat1', name: 'Taste' }],
  range: { min: 1, max: 3 },
  uniquePerCategory: false,
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

function renderScore() {
  return render(
    <MemoryRouter initialEntries={['/score']}>
      <Score />
    </MemoryRouter>,
  );
}

/** The rating radiogroup for a dish (single-category ballots). */
const ratingFor = (name: string) => screen.getByRole('radiogroup', { name: new RegExp(name, 'i') });

describe('Score screen', () => {
  beforeEach(() => {
    stubLocalStorage('c1');
    vi.mocked(api.getBallot).mockReset().mockResolvedValue(BALLOT);
    vi.mocked(api.getMyScores).mockReset().mockResolvedValue([]);
    vi.mocked(api.saveScore).mockReset().mockResolvedValue();
    vi.mocked(api.sendVote).mockReset().mockResolvedValue();
  });
  afterEach(() => vi.clearAllMocks());

  it('offers only the values in the allowed range', async () => {
    renderScore();
    const rating = await screen.findByRole('radiogroup', { name: /Tortilla/ });
    // Exactly 1, 2, 3 — no 0 and no 4.
    expect(within(rating).getAllByRole('radio')).toHaveLength(3);
    expect(within(rating).getByRole('radio', { name: '1' })).toBeInTheDocument();
    expect(within(rating).getByRole('radio', { name: '3' })).toBeInTheDocument();
    expect(within(rating).queryByRole('radio', { name: '4' })).not.toBeInTheDocument();
  });

  it('saves each score as it is chosen', async () => {
    renderScore();
    await screen.findByRole('radiogroup', { name: /Tortilla/ });
    await userEvent.click(within(ratingFor('Tortilla')).getByRole('radio', { name: '2' }));
    expect(api.saveScore).toHaveBeenCalledWith('c1', { dishId: 'D-C', categoryId: 'cat1', value: 2 });
  });

  it('cannot send until every dish is scored', async () => {
    renderScore();
    await screen.findByRole('radiogroup', { name: /Tortilla/ });

    expect(screen.getByRole('button', { name: 'Send my vote' })).toBeDisabled();

    await userEvent.click(within(ratingFor('Tortilla')).getByRole('radio', { name: '2' }));
    expect(screen.getByRole('button', { name: 'Send my vote' })).toBeDisabled(); // one dish still unscored

    await userEvent.click(within(ratingFor('Gazpacho')).getByRole('radio', { name: '3' }));
    expect(screen.getByRole('button', { name: 'Send my vote' })).toBeEnabled();
  });

  it('confirms before sending, then locks the vote (no re-send)', async () => {
    vi.mocked(api.getMyScores).mockResolvedValue([
      { dishId: 'D-C', categoryId: 'cat1', value: 2 },
      { dishId: 'D-D', categoryId: 'cat1', value: 3 },
    ]);
    renderScore();

    await userEvent.click(await screen.findByRole('button', { name: 'Send my vote' }));
    // A confirmation beat — nothing sent yet.
    expect(api.sendVote).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, send my vote' }));

    expect(api.sendVote).toHaveBeenCalledWith('c1');
    expect(await screen.findByText(/vote sent/i)).toBeInTheDocument();
    // Locked: the ratings and send control are gone.
    expect(screen.queryByRole('button', { name: 'Send my vote' })).not.toBeInTheDocument();
  });

  it('prompts to join when this device has no contest', async () => {
    stubLocalStorage(null);
    renderScore();
    expect(await screen.findByRole('heading', { name: 'Join first' })).toBeInTheDocument();
    expect(api.getBallot).not.toHaveBeenCalled();
  });

  it('shows a deferred note for a strict-ranking contest', async () => {
    vi.mocked(api.getBallot).mockResolvedValue({ ...BALLOT, uniquePerCategory: true });
    renderScore();
    expect(await screen.findByText(/strict ranking/i)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderScore();
    await screen.findByRole('radiogroup', { name: /Tortilla/ });
    expect(await axe(container)).toHaveNoViolations();
  });
});
