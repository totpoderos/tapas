import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
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

/*
 * Scoring is paginated now: `/score` is the ballot — every dish, what it was
 * given, and the way to send — and `/score/1` is the first dish's controls.
 * Tests say which they mean rather than relying on one page holding both.
 */
function renderScore(at = '/score') {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/score" element={<Score />} />
        <Route path="/score/:dish" element={<Score />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The rating radiogroup for a dish (single-category ballots). */
const ratingFor = (name: string) => screen.getByRole('radiogroup', { name: new RegExp(name, 'i') });

describe('Score screen', () => {
  beforeEach(() => {
    stubLocalStorage('c1');
    vi.mocked(api.getBallot).mockReset().mockResolvedValue(BALLOT);
    vi.mocked(api.getMyScores).mockReset().mockResolvedValue({ scores: [], status: 'draft' });
    vi.mocked(api.saveScore).mockReset().mockResolvedValue();
    vi.mocked(api.sendVote).mockReset().mockResolvedValue();
  });
  afterEach(() => vi.clearAllMocks());

  it('offers only the values in the allowed range', async () => {
    renderScore('/score/1');
    const rating = await screen.findByRole('radiogroup', { name: /Tortilla/ });
    // Exactly 1, 2, 3 — no 0 and no 4.
    expect(within(rating).getAllByRole('radio')).toHaveLength(3);
    expect(within(rating).getByRole('radio', { name: '1' })).toBeInTheDocument();
    expect(within(rating).getByRole('radio', { name: '3' })).toBeInTheDocument();
    expect(within(rating).queryByRole('radio', { name: '4' })).not.toBeInTheDocument();
  });

  it('saves each score as it is chosen', async () => {
    renderScore('/score/1');
    await screen.findByRole('radiogroup', { name: /Tortilla/ });
    await userEvent.click(within(ratingFor('Tortilla')).getByRole('radio', { name: '2' }));
    expect(api.saveScore).toHaveBeenCalledWith('c1', { dishId: 'D-C', categoryId: 'cat1', value: 2 });
  });

  it('cannot send until every dish is scored, and says what is missing', async () => {
    vi.mocked(api.getMyScores).mockResolvedValue({
      scores: [{ dishId: 'D-C', categoryId: 'cat1', value: 2 }],
      status: 'draft',
    });
    renderScore();

    expect(await screen.findByRole('button', { name: 'Send my vote' })).toBeDisabled();
    // Naming it is the point: a disabled button on its own explains nothing.
    expect(screen.getByText(/Taste is still missing for Gazpacho/i)).toBeInTheDocument();
  });

  it('shows one dish at a time, and says which of how many', async () => {
    renderScore('/score/2');
    expect(await screen.findByRole('heading', { name: 'Gazpacho' })).toBeInTheDocument();
    expect(screen.getByText('Dish 2 of 2')).toBeInTheDocument();
    // The other dish's controls are not on this screen.
    expect(screen.queryByRole('radiogroup', { name: /Tortilla/ })).not.toBeInTheDocument();
  });

  it('shows the scores already given when a dish is revisited', async () => {
    vi.mocked(api.getMyScores).mockResolvedValue({
      scores: [{ dishId: 'D-C', categoryId: 'cat1', value: 2 }],
      status: 'draft',
    });
    renderScore('/score/1');
    const rating = await screen.findByRole('radiogroup', { name: /Tortilla/ });
    expect(within(rating).getByRole('radio', { name: '2' })).toBeChecked();
  });

  it('marks a category still waiting, in words and not by colour alone', async () => {
    renderScore('/score/1');
    await screen.findByRole('radiogroup', { name: /Tortilla/ });
    expect(screen.getByText('your turn')).toBeInTheDocument();
  });

  it('lists every dish with what it was given, on the ballot', async () => {
    vi.mocked(api.getMyScores).mockResolvedValue({
      scores: [
        { dishId: 'D-C', categoryId: 'cat1', value: 2 },
        { dishId: 'D-D', categoryId: 'cat1', value: 3 },
      ],
      status: 'draft',
    });
    renderScore();
    const ballot = await screen.findByRole('list', { name: 'Your ballot' });
    expect(within(ballot).getByText('Tortilla')).toBeInTheDocument();
    expect(within(ballot).getByText('2')).toBeInTheDocument();
    expect(within(ballot).getByText('3')).toBeInTheDocument();
  });

  it('links from the ballot to the dish and category that is missing', async () => {
    vi.mocked(api.getMyScores).mockResolvedValue({
      scores: [{ dishId: 'D-C', categoryId: 'cat1', value: 2 }],
      status: 'draft',
    });
    renderScore();
    const link = await screen.findByRole('link', { name: /Taste missing/i });
    // Gazpacho is the second dish, and the link carries the category with it.
    expect(link).toHaveAttribute('href', '/score/2?category=cat1');
  });

  it('confirms before sending, then locks the vote (no re-send)', async () => {
    vi.mocked(api.getMyScores).mockResolvedValue({
      scores: [
        { dishId: 'D-C', categoryId: 'cat1', value: 2 },
        { dishId: 'D-D', categoryId: 'cat1', value: 3 },
      ],
      status: 'draft',
    });
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

  /*
   * The confirmation is a modal sheet over the ballot (screen 9). A sent vote
   * cannot be undone, so this beat is the only safety net there is: it has to
   * hold the keyboard while it is open, let it out again, and be resolved by
   * nothing except the participant's own two choices.
   */
  describe('the confirmation before sending', () => {
    beforeEach(() => {
      vi.mocked(api.getMyScores).mockResolvedValue({
        scores: [
          { dishId: 'D-C', categoryId: 'cat1', value: 2 },
          { dishId: 'D-D', categoryId: 'cat1', value: 3 },
        ],
        status: 'draft',
      });
    });

    /** Opens the sheet and hands back its dialog. */
    async function askToSend() {
      await userEvent.click(await screen.findByRole('button', { name: 'Send my vote' }));
      return screen.getByRole('dialog');
    }

    it('opens as a modal dialog named by what it is asking', async () => {
      renderScore();
      const sheet = await askToSend();

      expect(sheet).toHaveAttribute('aria-modal', 'true');
      expect(sheet).toHaveAccessibleName('Send your vote?');
      expect(sheet).toHaveAccessibleDescription(/can’t be changed or sent again/i);
      // Focus is on the sheet itself, so the question is announced whole and
      // neither answer is armed for a stray Enter.
      expect(sheet).toHaveFocus();
    });

    it('keeps the keyboard inside it, wrapping at both ends', async () => {
      renderScore();
      const sheet = await askToSend();
      const confirm = within(sheet).getByRole('button', { name: 'Yes, send my vote' });
      const cancel = within(sheet).getByRole('button', { name: 'Not yet' });

      await userEvent.tab();
      expect(confirm).toHaveFocus();
      await userEvent.tab();
      expect(cancel).toHaveFocus();
      // Past the last one, round to the first — never out to the ballot behind.
      await userEvent.tab();
      expect(confirm).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(cancel).toHaveFocus();
    });

    it('is dismissed by Escape, sending nothing and giving focus back', async () => {
      renderScore();
      await askToSend();

      await userEvent.keyboard('{Escape}');

      expect(api.sendVote).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // Back where they asked from, not adrift at the top of the ballot.
      expect(screen.getByRole('button', { name: 'Send my vote' })).toHaveFocus();
    });

    it('leaves the ballot exactly as it was when it is declined', async () => {
      renderScore();
      const sheet = await askToSend();
      await userEvent.click(within(sheet).getByRole('button', { name: 'Not yet' }));

      expect(api.sendVote).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send my vote' })).toBeEnabled();
      expect(within(screen.getByRole('list', { name: 'Your ballot' })).getByText('2')).toBeInTheDocument();
    });

    it('has no accessibility violations while it is open', async () => {
      const { container } = renderScore();
      await askToSend();
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  it('prompts to join when this device has no contest', async () => {
    stubLocalStorage(null);
    renderScore();
    expect(await screen.findByRole('heading', { name: 'Join first' })).toBeInTheDocument();
    expect(api.getBallot).not.toHaveBeenCalled();
  });

  it('has no accessibility violations while scoring a dish', async () => {
    const { container } = renderScore('/score/1');
    await screen.findByRole('radiogroup', { name: /Tortilla/ });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations on the ballot', async () => {
    const { container } = renderScore();
    await screen.findByRole('heading', { name: 'Your ballot' });
    expect(await axe(container)).toHaveNoViolations();
  });
});

/*
 * Screen 10. What a participant asks after sending is how they rated each dish,
 * so the record is a row per dish — not the row-per-dish-and-category list it
 * used to be, which grew with the categories and answered nobody's question.
 */
const TWO_CATEGORIES: Ballot = {
  ...BALLOT,
  categories: [
    { id: 'cat1', name: 'Taste' },
    { id: 'cat2', name: 'Texture' },
  ],
  range: { min: 1, max: 5 },
};

describe('Score screen — the vote is in', () => {
  beforeEach(() => {
    stubLocalStorage('c1');
    vi.mocked(api.getBallot).mockReset().mockResolvedValue(TWO_CATEGORIES);
    vi.mocked(api.getMyScores).mockReset().mockResolvedValue({
      scores: [
        { dishId: 'D-C', categoryId: 'cat1', value: 4 },
        { dishId: 'D-C', categoryId: 'cat2', value: 5 },
        { dishId: 'D-D', categoryId: 'cat1', value: 3 },
        { dishId: 'D-D', categoryId: 'cat2', value: 3 },
      ],
      status: 'sent',
    });
    vi.mocked(api.saveScore).mockReset().mockResolvedValue();
    vi.mocked(api.sendVote).mockReset().mockResolvedValue();
  });
  afterEach(() => vi.clearAllMocks());

  it('shows one row per dish, with every category named', async () => {
    renderScore();
    const record = await screen.findByRole('list', { name: 'Your vote is in' });

    // Two dishes, two rows — not the four a row-per-score list would give.
    expect(within(record).getAllByRole('listitem')).toHaveLength(2);
    expect(within(record).getByText('Taste 4 · Texture 5')).toBeInTheDocument();
    expect(within(record).getByText('Taste 3 · Texture 3')).toBeInTheDocument();
  });

  it('names the total as the participant’s own, not as the dish’s standing', async () => {
    renderScore();
    const record = await screen.findByRole('list', { name: 'Your vote is in' });

    // "you gave 9", not a bare 9: the reveal will show this dish carrying every
    // judge's scores, and an unqualified number here would read as a rival total.
    expect(within(record).getByText('you gave 9')).toBeInTheDocument();
    expect(within(record).getByText('you gave 6')).toBeInTheDocument();
  });

  it('leaves the total out where a single category makes it a repeat', async () => {
    vi.mocked(api.getBallot).mockResolvedValue(BALLOT); // one category
    vi.mocked(api.getMyScores).mockResolvedValue({
      scores: [
        { dishId: 'D-C', categoryId: 'cat1', value: 2 },
        { dishId: 'D-D', categoryId: 'cat1', value: 3 },
      ],
      status: 'sent',
    });
    renderScore();
    const record = await screen.findByRole('list', { name: 'Your vote is in' });

    expect(within(record).getByText('Taste 2')).toBeInTheDocument();
    expect(within(record).queryByText(/you gave/)).not.toBeInTheDocument();
  });

  /*
   * The scores shown come from what is held now, not from what happened to be
   * loaded at mount — otherwise a vote scored and sent in one sitting arrives at
   * this screen with nothing to show, while the same vote seen after a reload
   * shows everything. Two paths, one of them silently empty.
   */
  it('shows what was given when the vote was scored and sent in this sitting', async () => {
    vi.mocked(api.getBallot).mockResolvedValue(BALLOT); // one category, two dishes
    vi.mocked(api.getMyScores).mockResolvedValue({ scores: [], status: 'draft' });
    renderScore('/score/1');

    const first = await screen.findByRole('radiogroup', { name: /Tortilla/ });
    await userEvent.click(within(first).getByRole('radio', { name: '2' }));
    await userEvent.click(screen.getByRole('link', { name: /next dish/i }));
    const second = await screen.findByRole('radiogroup', { name: /Gazpacho/ });
    await userEvent.click(within(second).getByRole('radio', { name: '3' }));
    await userEvent.click(screen.getByRole('link', { name: /review and send/i }));

    await userEvent.click(await screen.findByRole('button', { name: 'Send my vote' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, send my vote' }));

    const record = await screen.findByRole('list', { name: 'Your vote is in' });
    expect(within(record).getByText('Tortilla')).toBeInTheDocument();
    expect(within(record).getByText('Taste 2')).toBeInTheDocument();
    expect(within(record).getByText('Taste 3')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderScore();
    await screen.findByRole('list', { name: 'Your vote is in' });
    expect(await axe(container)).toHaveNoViolations();
  });
});

const RANKING = { ...BALLOT, uniquePerCategory: true, range: { min: 1, max: 2 } };
const rankSelect = (dish: string) => screen.getByRole('combobox', { name: new RegExp(`rank for ${dish}`, 'i') });

describe('Score screen — strict ranking', () => {
  beforeEach(() => {
    stubLocalStorage('c1');
    vi.mocked(api.getBallot).mockReset().mockResolvedValue(RANKING);
    vi.mocked(api.getMyScores).mockReset().mockResolvedValue({ scores: [], status: 'draft' });
    vi.mocked(api.saveScore).mockReset().mockResolvedValue();
    vi.mocked(api.sendVote).mockReset().mockResolvedValue();
  });
  afterEach(() => vi.clearAllMocks());

  it('saves a category once every dish has a rank, and enables send', async () => {
    renderScore();
    await screen.findByRole('heading', { name: 'Rank the dishes' });

    await userEvent.selectOptions(rankSelect('Tortilla'), '1');
    expect(screen.getByRole('button', { name: 'Send my vote' })).toBeDisabled(); // one dish still unranked
    expect(api.saveScore).not.toHaveBeenCalled(); // category not full yet

    await userEvent.selectOptions(rankSelect('Gazpacho'), '2');
    // Full permutation → the whole category is saved.
    expect(api.saveScore).toHaveBeenCalledWith('c1', { dishId: 'D-C', categoryId: 'cat1', value: 1 });
    expect(api.saveScore).toHaveBeenCalledWith('c1', { dishId: 'D-D', categoryId: 'cat1', value: 2 });
    expect(screen.getByRole('button', { name: 'Send my vote' })).toBeEnabled();
  });

  it('swaps when a rank held by another dish is chosen, keeping a permutation', async () => {
    // Resume with a full ranking: Tortilla 1, Gazpacho 2.
    vi.mocked(api.getMyScores).mockResolvedValue({
      scores: [
        { dishId: 'D-C', categoryId: 'cat1', value: 1 },
        { dishId: 'D-D', categoryId: 'cat1', value: 2 },
      ],
      status: 'draft',
    });
    renderScore();
    await screen.findByRole('heading', { name: 'Rank the dishes' });

    // Give Tortilla rank 2 — Gazpacho already holds it, so they swap.
    await userEvent.selectOptions(rankSelect('Tortilla'), '2');

    expect(rankSelect('Tortilla')).toHaveValue('2');
    expect(rankSelect('Gazpacho')).toHaveValue('1');
    expect(api.saveScore).toHaveBeenCalledWith('c1', { dishId: 'D-C', categoryId: 'cat1', value: 2 });
    expect(api.saveScore).toHaveBeenCalledWith('c1', { dishId: 'D-D', categoryId: 'cat1', value: 1 });
  });

  it('has no accessibility violations in ranking mode', async () => {
    const { container } = renderScore();
    await screen.findByRole('heading', { name: 'Rank the dishes' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
