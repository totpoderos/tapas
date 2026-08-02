import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContestControl } from '../../src/pages/contest-control';
import { ContestsProvider } from '../../src/contests/contests-provider';
import type { ContestDetail, Tally } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return {
    ...actual,
    getContest: vi.fn(),
    getTally: vi.fn(),
    closeContest: vi.fn(),
    revealContest: vi.fn(),
    // Deleting re-reads the panel's list, so the provider is in play here too.
    listContests: vi.fn(),
  };
});
import * as api from '../../src/api/client';

const RULES: ContestDetail['rules'] = {
  format: 'solo_with_partners',
  categories: [
    { id: 'taste', name: 'Taste' },
    { id: 'look', name: 'Look' },
  ],
  uniquePerCategory: true,
  scoreRange: { min: 1, max: 10 },
};
const LIVE: ContestDetail = {
  id: 'c1',
  name: 'Summer Tapas',
  status: 'live',
  joinCode: 'ABCD12',
  rules: RULES,
};
// Five places, four of them claimed — the counts read against what they are out of.
const TALLY: Tally = { placeCount: 5, claimedCount: 4, draftCount: 1, sentCount: 3 };

function renderControl() {
  return render(
    <MemoryRouter initialEntries={['/contest/c1']}>
      <ContestsProvider>
        <Routes>
          <Route path="/contest/:id" element={<ContestControl />} />
          <Route path="/log/:id" element={<h1>Activity</h1>} />
        </Routes>
      </ContestsProvider>
    </MemoryRouter>,
  );
}

describe('Contest control room', () => {
  beforeEach(() => {
    vi.mocked(api.listContests).mockReset().mockResolvedValue([]);
    vi.mocked(api.getContest).mockReset().mockResolvedValue(LIVE);
    vi.mocked(api.getTally).mockReset().mockResolvedValue(TALLY);
    vi.mocked(api.closeContest).mockReset().mockResolvedValue();
    vi.mocked(api.revealContest).mockReset().mockResolvedValue();
  });
  afterEach(() => vi.clearAllMocks());

  /*
   * The contest's name and its state are the panel's to say now, not this
   * screen's — see panel-shell.test.tsx. Asserting them here again would be
   * testing the shell through a page that no longer draws them, which is how the
   * three duplicate-name flakes got in.
   */
  it('shows the join code and offers to copy it', async () => {
    renderControl();
    expect(await screen.findByText('ABCD12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
  });

  it('offers the scannable code without showing it until it is asked for', async () => {
    renderControl();
    await screen.findByText('ABCD12');

    const show = screen.getByRole('button', { name: 'Show QR' });
    expect(show).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('img', { name: /ABCD12/ })).not.toBeInTheDocument();

    await userEvent.click(show);

    expect(await screen.findByRole('img', { name: /ABCD12/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide QR' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    // The code stays printed and copying stays offered — a scan yields the code,
    // which somebody then types.
    expect(screen.getByText('ABCD12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
  });

  it('can hide the scannable code again', async () => {
    renderControl();
    await screen.findByText('ABCD12');

    await userEvent.click(screen.getByRole('button', { name: 'Show QR' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hide QR' }));

    expect(screen.queryByRole('img', { name: /ABCD12/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show QR' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('offers no scannable code once the results are out, since nobody can still join', async () => {
    vi.mocked(api.getContest).mockResolvedValue({ ...LIVE, status: 'revealed' });
    renderControl();

    await screen.findByRole('link', { name: 'See the results' });
    expect(screen.queryByRole('button', { name: 'Show QR' })).not.toBeInTheDocument();
    expect(screen.queryByText('ABCD12')).not.toBeInTheDocument();
  });

  it('shows the tally against the number of places there are', async () => {
    renderControl();

    const progress = await screen.findByRole('region', { name: 'Progress' });
    // Four of five joined, three of them sent — said in words, not only as a bar.
    expect(within(progress).getByText('4 joined of 5 participants')).toBeInTheDocument();
    expect(within(progress).getByText('3 of 5 votes sent')).toBeInTheDocument();
    expect(within(progress).getByText('Joined')).toBeInTheDocument();
    expect(within(progress).getByText('Still scoring')).toBeInTheDocument();
    expect(within(progress).getByText('Votes sent')).toBeInTheDocument();
  });

  it('shows the rules the contest is being played by', async () => {
    renderControl();

    const rules = await screen.findByRole('region', { name: 'Rules in force' });
    expect(
      within(rules).getByText('Everyone on their own, partners kept apart'),
    ).toBeInTheDocument();
    expect(within(rules).getByText('Taste, Look')).toBeInTheDocument();
    expect(within(rules).getByText('1–10')).toBeInTheDocument();
    expect(within(rules).getByText('On')).toBeInTheDocument();
  });

  it('says nothing about a rule the contest never recorded', async () => {
    // A contest that recorded no format. 'solo' is itself a real choice, so an
    // unrecorded format must not be shown as one.
    vi.mocked(api.getContest).mockResolvedValue({
      ...LIVE,
      rules: { categories: [], uniquePerCategory: false },
    });
    renderControl();

    const rules = await screen.findByRole('region', { name: 'Rules in force' });
    expect(within(rules).queryByText('Everyone on their own')).not.toBeInTheDocument();
    expect(
      within(rules).queryByText('Everyone on their own, partners kept apart'),
    ).not.toBeInTheDocument();
    expect(within(rules).getByText('Unique per category')).toBeInTheDocument();
  });

  it('shows revealing before it is possible, but will not let it be taken', async () => {
    renderControl();

    // Drawn while the contest is live so a host can see what comes next, and
    // disabled rather than merely dimmed so the keyboard cannot reach it either.
    expect(await screen.findByRole('button', { name: 'Reveal results' })).toBeDisabled();
  });

  it('closes voting only after the confirmation is accepted', async () => {
    vi.mocked(api.getContest)
      .mockResolvedValueOnce(LIVE)
      .mockResolvedValue({ ...LIVE, status: 'closed' });
    renderControl();

    await userEvent.click(await screen.findByRole('button', { name: 'Close voting' }));
    // A confirmation appears; nothing closed yet.
    expect(api.closeContest).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close voting' }));

    expect(api.closeContest).toHaveBeenCalledWith('c1');
    // Closed, so revealing becomes takeable — the state itself is the panel's to say.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Reveal results' })).toBeEnabled(),
    );
  });

  it('cancelling the confirmation leaves the contest live', async () => {
    renderControl();
    await userEvent.click(await screen.findByRole('button', { name: 'Close voting' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(api.closeContest).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    // Still live: closing is still on offer and revealing still is not.
    expect(screen.getByRole('button', { name: 'Close voting' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reveal results' })).toBeDisabled();
  });

  it('offers Reveal for a closed contest and reveals on confirm', async () => {
    vi.mocked(api.getContest)
      .mockResolvedValueOnce({ ...LIVE, status: 'closed' })
      .mockResolvedValue({ ...LIVE, status: 'revealed' });
    renderControl();

    await userEvent.click(await screen.findByRole('button', { name: 'Reveal results' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reveal results' }));

    expect(api.revealContest).toHaveBeenCalledWith('c1');
    expect(await screen.findByText(/results are out/i)).toBeInTheDocument();
  });

  /*
   * A contest whose close rule is `all_sent` — the default — closes itself the
   * moment the last vote lands. Nobody presses anything, so the control room
   * only finds out by asking.
   *
   * It used to poll the tally alone, so the counts filled up while the panel
   * went on believing the contest was live: "Close voting" stayed on offer and
   * "Reveal results" stayed disabled. The host's only way through was to press
   * Close, be told the contest could not be closed, and carry on from the error.
   */
  it('notices a contest that closed itself, without the host having to try', async () => {
    vi.mocked(api.getContest)
      .mockResolvedValueOnce(LIVE)
      .mockResolvedValue({ ...LIVE, status: 'closed' });
    // Every claimed place has sent — which is what closed it.
    vi.mocked(api.getTally).mockResolvedValue({ ...TALLY, draftCount: 0, sentCount: 4 });

    renderControl();
    expect(await screen.findByRole('button', { name: 'Close voting' })).toBeEnabled();

    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Reveal results' })).toBeEnabled(),
      { timeout: 8000 },
    );
    // And closing is no longer offered, because there is nothing left to close.
    expect(screen.getByRole('button', { name: 'Close voting' })).toBeDisabled();
    // Nothing went wrong, so nothing is reported as having gone wrong.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  }, 15_000);

  /*
   * The same race, from the other side: the host presses Close in the instant
   * between the last vote landing and the next poll. The contest is closed
   * either way, which is exactly what they asked for — so it is not a failure.
   */
  it('treats closing an already-closed contest as done, not as a failure', async () => {
    vi.mocked(api.getContest)
      .mockResolvedValueOnce(LIVE)
      .mockResolvedValue({ ...LIVE, status: 'closed' });
    vi.mocked(api.closeContest).mockRejectedValue(
      new api.ApiError(409, 'ALREADY_CLOSED', 'This contest is already closed.'),
    );

    renderControl();
    await userEvent.click(await screen.findByRole('button', { name: 'Close voting' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Close voting' }),
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Reveal results' })).toBeEnabled(),
    );
  });

  /* A close that genuinely failed still has to say so. */
  it('still reports a close that really did fail', async () => {
    vi.mocked(api.closeContest).mockRejectedValue(
      new api.ApiError(500, 'INTERNAL', 'Something broke.'),
    );

    renderControl();
    await userEvent.click(await screen.findByRole('button', { name: 'Close voting' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Close voting' }),
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('has no accessibility violations, live and with the confirmation open', async () => {
    const { container } = renderControl();
    await screen.findByRole('region', { name: 'Progress' });
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole('button', { name: 'Close voting' }));
    await screen.findByRole('alertdialog');
    expect(await axe(container)).toHaveNoViolations();
  });
});
