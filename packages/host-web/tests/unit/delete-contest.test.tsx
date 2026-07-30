import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Home } from '../../src/pages/home';
import { ContestsProvider } from '../../src/contests/contests-provider';
import { ApiError, type ContestSummary } from '../../src/api/client';
import '../../src/i18n';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual =
    await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, listContests: vi.fn(), deleteContest: vi.fn() };
});
import * as api from '../../src/api/client';

vi.mock('../../src/auth/session', () => ({ useSession: () => ({ signOut: vi.fn() }) }));

const CONTESTS: ContestSummary[] = [
  { id: 'c1', name: 'Summer Tapas', status: 'live', updatedAt: '2026-07-28T10:00:00.000Z' },
  { id: 'd1', name: 'Winter Draft', status: 'draft', updatedAt: '2026-07-27T10:00:00.000Z' },
];

/** The API's "someone has taken part — make them type the name". */
const needsName = () =>
  new ApiError(428, 'CONFIRMATION_REQUIRED', 'Type the contest’s name to confirm deleting it.');

/**
 * The contest list belongs to the panel now, so the screen is rendered inside the
 * provider that holds it — the same arrangement the app uses.
 */
function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ContestsProvider>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </ContestsProvider>
    </MemoryRouter>,
  );
}

const openDeleteFor = async (name: string) => {
  await userEvent.click(await screen.findByRole('button', { name: `Delete ${name}` }));
};

/**
 * Deleting is the one action with no undo, so the guard is what these tests are
 * really about: the host is always asked, the ask gets harder once other people
 * have invested something, and nothing is destroyed until the right words are in.
 */
describe('deleting a contest from the host app', () => {
  beforeEach(() => {
    /*
     * A deleted contest is gone from the server, and the panel re-reads the list
     * rather than striking the row out locally — the sidebar counts the same
     * contests, and a local edit would leave them disagreeing with the table. So
     * the fixture has to delete for real: a static list would hand the row back
     * on the very next read and the screen would look like nothing happened.
     */
    let remaining = [...CONTESTS];
    vi.mocked(api.listContests)
      .mockReset()
      .mockImplementation(() => Promise.resolve(remaining));
    vi.mocked(api.deleteContest)
      .mockReset()
      .mockImplementation((id) => {
        remaining = remaining.filter((contest) => contest.id !== id);
        return Promise.resolve();
      });
  });
  afterEach(() => vi.clearAllMocks());

  it('asks before deleting anything', async () => {
    renderHome();
    await openDeleteFor('Winter Draft');

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(api.deleteContest).not.toHaveBeenCalled();
  });

  it('deletes an untouched contest with a single confirmation', async () => {
    renderHome();
    await openDeleteFor('Winter Draft');
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete for good' }),
    );

    expect(api.deleteContest).toHaveBeenCalledWith('d1', undefined);
    expect(await screen.findByRole('status')).toHaveTextContent('“Winter Draft” was deleted.');
    expect(screen.queryByRole('link', { name: 'Winter Draft' })).not.toBeInTheDocument();
  });

  it('backing out destroys nothing', async () => {
    renderHome();
    await openDeleteFor('Winter Draft');
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(api.deleteContest).not.toHaveBeenCalled();
    expect(await screen.findByRole('link', { name: 'Winter Draft' })).toBeInTheDocument();
  });

  it('escapes out of the dialog without deleting', async () => {
    renderHome();
    await openDeleteFor('Winter Draft');
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(api.deleteContest).not.toHaveBeenCalled();
  });

  // The escalation is the API's call, not the browser's: a 428 means people have
  // taken part, and only then does the dialog ask for the name.
  it('asks for the name once the API says people have taken part', async () => {
    vi.mocked(api.deleteContest).mockRejectedValueOnce(needsName());
    renderHome();
    await openDeleteFor('Summer Tapas');
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete for good' }));

    expect(await screen.findByLabelText('Contest name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete for good' })).toBeDisabled();
  });

  it('stays locked until the name matches exactly', async () => {
    vi.mocked(api.deleteContest).mockRejectedValueOnce(needsName());
    renderHome();
    await openDeleteFor('Summer Tapas');
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete for good' }));

    const field = await screen.findByLabelText('Contest name');
    await userEvent.type(field, 'Summer Tapa');
    expect(screen.getByRole('button', { name: 'Delete for good' })).toBeDisabled();

    await userEvent.type(field, 's');
    expect(screen.getByRole('button', { name: 'Delete for good' })).toBeEnabled();
  });

  it('deletes with the name once it matches, and only then', async () => {
    vi.mocked(api.deleteContest).mockRejectedValueOnce(needsName());
    renderHome();
    await openDeleteFor('Summer Tapas');
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete for good' }));

    await userEvent.type(await screen.findByLabelText('Contest name'), 'Summer Tapas');
    await userEvent.click(screen.getByRole('button', { name: 'Delete for good' }));

    expect(api.deleteContest).toHaveBeenLastCalledWith('c1', 'Summer Tapas');
    expect(await screen.findByRole('status')).toHaveTextContent('“Summer Tapas” was deleted.');
  });

  it('reports a failure it cannot explain, and keeps the contest', async () => {
    vi.mocked(api.deleteContest).mockRejectedValue(new Error('network'));
    renderHome();
    await openDeleteFor('Winter Draft');
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete for good' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t be deleted/i);
    expect(screen.getByRole('link', { name: 'Winter Draft' })).toBeInTheDocument();
  });

  it('has no accessibility violations with the plain confirmation open', async () => {
    const { container } = renderHome();
    await openDeleteFor('Winter Draft');
    await screen.findByRole('alertdialog');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations with the typed-name confirmation open', async () => {
    vi.mocked(api.deleteContest).mockRejectedValueOnce(needsName());
    const { container } = renderHome();
    await openDeleteFor('Summer Tapas');
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete for good' }));
    await screen.findByLabelText('Contest name');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps focus inside the dialog when tabbing', async () => {
    vi.mocked(api.deleteContest).mockRejectedValueOnce(needsName());
    renderHome();
    await openDeleteFor('Summer Tapas');
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete for good' }));

    const dialog = await screen.findByRole('alertdialog');
    await screen.findByLabelText('Contest name');
    for (let i = 0; i < 6; i += 1) {
      await userEvent.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });
});

