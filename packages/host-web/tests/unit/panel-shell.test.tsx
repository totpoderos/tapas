import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app';
import { SessionProvider } from '../../src/auth/session';
import type { ContestSummary } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>(
    '../../src/api/client',
  );
  return {
    ...actual,
    whoAmI: vi.fn(),
    isDeploymentUnclaimed: vi.fn(),
    listContests: vi.fn(),
    listHostAccounts: vi.fn(),
    listInvitations: vi.fn(),
    getContest: vi.fn(),
    getTally: vi.fn(),
    getAuditLog: vi.fn(),
  };
});
import * as api from '../../src/api/client';

const HOST = { hostId: 'h1', role: 'host' as const };
const ADMINISTRATOR = { hostId: 'a1', role: 'admin' as const };

const contest = (
  over: Partial<ContestSummary> & Pick<ContestSummary, 'id' | 'name' | 'status'>,
): ContestSummary => ({ updatedAt: '2026-07-20T10:00:00.000Z', ...over });

const LIVE = contest({ id: 'live-1', name: 'Spring Tapas Crawl', status: 'live' });
const DRAFT = contest({ id: 'draft-1', name: 'Barrio Supper Club', status: 'draft' });
const REVEALED = contest({ id: 'done-1', name: 'Winter Tapeo', status: 'revealed' });
const CLOSED = contest({ id: 'shut-1', name: 'Pintxos Night', status: 'closed' });

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </MemoryRouter>,
  );
}

/** The panel's navigation, which is one landmark wherever the host is. */
const navigation = () => screen.getByRole('navigation', { name: 'Panel navigation' });

/**
 * Implements tests/e2e/host-panel-shell.feature at the component level: the panel
 * carries its navigation everywhere, says where the host is, and never mixes a
 * host's work with an administrator's.
 */
describe('The panel shell', () => {
  beforeEach(() => {
    vi.mocked(api.isDeploymentUnclaimed).mockResolvedValue(false);
    vi.mocked(api.whoAmI).mockResolvedValue(HOST);
    vi.mocked(api.listContests).mockResolvedValue([LIVE, DRAFT, REVEALED, CLOSED]);
    vi.mocked(api.getContest).mockResolvedValue({
      id: LIVE.id,
      name: LIVE.name,
      status: 'live',
      joinCode: '4KQ-207',
      rules: { categories: [], uniquePerCategory: false },
    });
    vi.mocked(api.getTally).mockResolvedValue({
      placeCount: 0,
      claimedCount: 0,
      draftCount: 0,
      sentCount: 0,
    });
    vi.mocked(api.getAuditLog).mockResolvedValue([]);
  });
  afterEach(() => vi.clearAllMocks());

  it('is present on every screen a host can reach', async () => {
    for (const path of ['/', '/chat', '/new', `/contest/${LIVE.id}`, `/review/${DRAFT.id}`]) {
      const { unmount } = renderAt(path);
      expect(await screen.findByRole('navigation', { name: 'Panel navigation' })).toBeInTheDocument();
      unmount();
    }
  });

  it('is absent when nobody is signed in', async () => {
    vi.mocked(api.whoAmI).mockResolvedValue(null);
    renderAt('/');

    await screen.findByRole('heading', { name: 'Welcome back' });
    expect(screen.queryByRole('navigation', { name: 'Panel navigation' })).not.toBeInTheDocument();
  });

  it('offers the assistant from inside a contest, without going back to the list', async () => {
    renderAt(`/log/${LIVE.id}`);

    const nav = await screen.findByRole('navigation', { name: 'Panel navigation' });
    expect(within(nav).getByRole('link', { name: 'Assistant' })).toHaveAttribute('href', '/chat');
    expect(within(nav).getByRole('link', { name: 'All contests' })).toHaveAttribute('href', '/');
  });

  it('marks the surface the host is on, and only that one', async () => {
    renderAt(`/log/${LIVE.id}`);

    const nav = await screen.findByRole('navigation', { name: 'Panel navigation' });
    expect(within(nav).getByRole('link', { name: 'Activity log' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Control room' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  /*
   * A contest being prepared is settled in two sections, so the navigation offers
   * both under its name. Which one is current is derived from the address, and the
   * shorter route pattern must not claim the longer path — get that wrong and the
   * wrong section is marked, silently, with nothing failing.
   */
  it('offers both sections of a contest being prepared', async () => {
    renderAt(`/review/${DRAFT.id}`);

    const nav = await screen.findByRole('navigation', { name: 'Panel navigation' });
    expect(within(nav).getByRole('link', { name: 'Rules' })).toHaveAttribute(
      'href',
      `/review/${DRAFT.id}`,
    );
    expect(within(nav).getByRole('link', { name: 'Participants & pairing' })).toHaveAttribute(
      'href',
      `/review/${DRAFT.id}/people`,
    );
    expect(within(nav).getByText(/not published/)).toBeInTheDocument();
  });

  it('marks the rules when the host is on them', async () => {
    renderAt(`/review/${DRAFT.id}`);

    const nav = await screen.findByRole('navigation', { name: 'Panel navigation' });
    expect(within(nav).getByRole('link', { name: 'Rules' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      within(nav).getByRole('link', { name: 'Participants & pairing' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('marks the participants when the host is on them', async () => {
    renderAt(`/review/${DRAFT.id}/people`);

    const nav = await screen.findByRole('navigation', { name: 'Panel navigation' });
    expect(within(nav).getByRole('link', { name: 'Participants & pairing' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Rules' })).not.toHaveAttribute('aria-current');
  });

  it('names the section in the header, under the contest', async () => {
    renderAt(`/review/${DRAFT.id}/people`);

    await screen.findByRole('navigation', { name: 'Panel navigation' });
    // Twice: the way in, and the breadcrumb naming where the host is.
    expect(screen.getAllByText('Participants & pairing')).toHaveLength(2);
  });

  /*
   * A key that no longer exists is echoed back by i18next as its own name, so the
   * header read "shell.reviewDraft" where it should have named the section. Nothing
   * failed — the string was simply the wrong string, and no test looked at the
   * header at all. This looks, on every surface, for anything shaped like a key.
   */
  it('never shows a translation key where a translation should be', async () => {
    for (const path of [
      '/',
      '/chat',
      '/new',
      `/contest/${LIVE.id}`,
      `/log/${LIVE.id}`,
      `/review/${DRAFT.id}`,
      `/review/${DRAFT.id}/people`,
    ]) {
      const { unmount } = renderAt(path);
      await screen.findByRole('navigation', { name: 'Panel navigation' });
      expect(document.body.textContent).not.toMatch(
        /\b(shell|common|home|reviewDraft|contestControl|auditLog|newContest)\.[a-zA-Z]/,
      );
      unmount();
    }
  });

  it('counts the host’s contests by state', async () => {
    renderAt('/');

    const nav = await screen.findByRole('navigation', { name: 'Panel navigation' });
    // The counts arrive with the list — until then the panel says nothing rather
    // than "0", so they are waited for.
    await screen.findByRole('table', { name: 'Your contests' });
    // Four in total: one live, one being prepared, and two finished.
    expect(within(nav).getByRole('link', { name: /All contests/ })).toHaveTextContent('4');
    expect(within(nav).getByRole('link', { name: /^Live/ })).toHaveTextContent('1');
    expect(within(nav).getByRole('link', { name: /^Drafts/ })).toHaveTextContent('1');
    expect(within(nav).getByRole('link', { name: /Closed & revealed/ })).toHaveTextContent('2');
  });

  it('says a host with no contests has none, rather than nothing at all', async () => {
    vi.mocked(api.listContests).mockResolvedValue([]);
    renderAt('/');

    const nav = await screen.findByRole('navigation', { name: 'Panel navigation' });
    expect(await within(nav).findByText(/None yet/)).toBeInTheDocument();
  });

  it('narrows the list to one state when asked', async () => {
    renderAt('/?state=live');

    const table = await screen.findByRole('table', { name: 'Your contests' });
    expect(within(table).getByText('Spring Tapas Crawl')).toBeInTheDocument();
    expect(within(table).queryByText('Barrio Supper Club')).not.toBeInTheDocument();
  });

  it('is about the contest the host is inside', async () => {
    renderAt(`/contest/${LIVE.id}`);

    const nav = await screen.findByRole('navigation', { name: 'Panel navigation' });
    // The name arrives with the list, so it is waited for rather than assumed.
    expect(await within(nav).findByText('Spring Tapas Crawl')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Activity log' })).toHaveAttribute(
      'href',
      `/log/${LIVE.id}`,
    );
  });

  it('shows the results of an unrevealed contest as not available, and does not offer them', async () => {
    renderAt(`/contest/${LIVE.id}`);

    const nav = await screen.findByRole('navigation', { name: 'Panel navigation' });
    // Waited for the list, so this cannot pass merely because the state is not in yet.
    await within(nav).findByText('Spring Tapas Crawl');
    expect(within(nav).getByText('— after reveal')).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Results' })).not.toBeInTheDocument();
  });

  it('offers the results once they are out', async () => {
    renderAt(`/contest/${REVEALED.id}`);

    const nav = await screen.findByRole('navigation', { name: 'Panel navigation' });
    expect(await within(nav).findByRole('link', { name: 'Results' })).toHaveAttribute(
      'href',
      `/results/${REVEALED.id}`,
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = renderAt('/');

    await screen.findByRole('table', { name: 'Your contests' });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('The panel does not mix the two kinds of work', () => {
  beforeEach(() => {
    vi.mocked(api.isDeploymentUnclaimed).mockResolvedValue(false);
    vi.mocked(api.listContests).mockResolvedValue([LIVE]);
    vi.mocked(api.listHostAccounts).mockResolvedValue([]);
    vi.mocked(api.listInvitations).mockResolvedValue([]);
  });
  afterEach(() => vi.clearAllMocks());

  it('gives an administrator administration only, and asks for no contest list', async () => {
    vi.mocked(api.whoAmI).mockResolvedValue(ADMINISTRATOR);
    renderAt('/');

    expect(await screen.findByRole('heading', { name: 'People' })).toBeInTheDocument();
    const nav = navigation();
    expect(within(nav).getByRole('link', { name: 'People & access' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'All contests' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Assistant' })).not.toBeInTheDocument();
    // Their panel draws no contests, so it must not ask for any.
    expect(api.listContests).not.toHaveBeenCalled();
  });

  it('takes an administrator asking for a host surface to the people', async () => {
    vi.mocked(api.whoAmI).mockResolvedValue(ADMINISTRATOR);
    renderAt(`/contest/${LIVE.id}`);

    expect(await screen.findByRole('heading', { name: 'People' })).toBeInTheDocument();
  });

  it('gives a host their own work, and no way to the people', async () => {
    vi.mocked(api.whoAmI).mockResolvedValue(HOST);
    renderAt('/');

    const nav = await screen.findByRole('navigation', { name: 'Panel navigation' });
    expect(within(nav).getByRole('link', { name: /All contests/ })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'People & access' })).not.toBeInTheDocument();
  });

  it('leaves a host who reaches the people there, told, with their own navigation', async () => {
    vi.mocked(api.whoAmI).mockResolvedValue(HOST);
    vi.mocked(api.listHostAccounts).mockRejectedValue(new api.ApiError(403, 'NOT_ALLOWED'));
    vi.mocked(api.listInvitations).mockRejectedValue(new api.ApiError(403, 'NOT_ALLOWED'));
    renderAt('/people');

    // Hiding the way in is a courtesy; the refusal is the protection.
    expect(
      await screen.findByRole('heading', { name: 'This screen is not for you' }),
    ).toBeInTheDocument();
    expect(within(navigation()).getByRole('link', { name: /All contests/ })).toBeInTheDocument();
  });
});
