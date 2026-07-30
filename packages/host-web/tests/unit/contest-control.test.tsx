import { render, screen, within } from '@testing-library/react';
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

const LIVE: ContestDetail = { id: 'c1', name: 'Summer Tapas', status: 'live', joinCode: 'ABCD12' };
const TALLY: Tally = { claimedCount: 4, draftCount: 1, sentCount: 3 };

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

  it('shows the join code and the live tally', async () => {
    renderControl();
    expect(await screen.findByRole('heading', { name: 'Summer Tapas' })).toBeInTheDocument();
    expect(screen.getByText('ABCD12')).toBeInTheDocument();
    const progress = screen.getByLabelText('Progress');
    expect(within(progress).getByText('4')).toBeInTheDocument(); // joined
    expect(within(progress).getByText('3')).toBeInTheDocument(); // sent
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
    expect(await screen.findByText('Closed')).toBeInTheDocument();
  });

  it('cancelling the confirmation leaves the contest live', async () => {
    renderControl();
    await userEvent.click(await screen.findByRole('button', { name: 'Close voting' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(api.closeContest).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
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

  it('has no accessibility violations, live and with the confirmation open', async () => {
    const { container } = renderControl();
    await screen.findByRole('heading', { name: 'Summer Tapas' });
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole('button', { name: 'Close voting' }));
    await screen.findByRole('alertdialog');
    expect(await axe(container)).toHaveNoViolations();
  });
});
