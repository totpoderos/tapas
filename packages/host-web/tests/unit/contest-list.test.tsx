import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app';
import { SessionProvider } from '../../src/auth/session';
import type { ContestSummary } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, whoAmI: vi.fn(), signOut: vi.fn(), listContests: vi.fn() };
});
import * as api from '../../src/api/client';

const summary = (over: Partial<ContestSummary> & Pick<ContestSummary, 'id' | 'name' | 'status'>): ContestSummary => ({
  updatedAt: '2026-07-20T10:00:00.000Z',
  ...over,
});

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('Host contest list', () => {
  beforeEach(() => {
    vi.mocked(api.whoAmI).mockResolvedValue({ hostId: 'h1', role: 'host' }); // a signed-in host
  });
  afterEach(() => vi.clearAllMocks());

  // The list is a table now: these are rows of related fields under column
  // headings, so assistive technology should be able to say which column a cell
  // is in. The words a host reads are unchanged.
  it('lists each contest with its status as a readable word', async () => {
    vi.mocked(api.listContests).mockResolvedValue([
      summary({ id: 'a', name: 'Balcony Cook-off', status: 'live' }),
      summary({ id: 'b', name: 'Summer Tapas', status: 'draft' }),
      summary({ id: 'c', name: 'Winter Feast', status: 'revealed' }),
      summary({ id: 'd', name: 'Rooftop Rounds', status: 'closed' }),
    ]);

    renderApp();

    const list = await screen.findByRole('table', { name: 'Your contests' });
    const [, live, draft, revealed, closed] = within(list).getAllByRole('row'); // [0] is the header
    expect(within(live!).getByText('Balcony Cook-off')).toBeInTheDocument();
    expect(within(live!).getByText('Live')).toBeInTheDocument();
    expect(within(draft!).getByText('Draft')).toBeInTheDocument();
    expect(within(revealed!).getByText('Revealed')).toBeInTheDocument();
    expect(within(closed!).getByText('Closed')).toBeInTheDocument();
  });

  it('opens a draft for review and a published contest for its control room', async () => {
    vi.mocked(api.listContests).mockResolvedValue([
      summary({ id: 'draft-1', name: 'Summer Tapas', status: 'draft' }),
      summary({ id: 'live-1', name: 'Balcony Cook-off', status: 'live' }),
    ]);
    renderApp();

    const draftLink = await screen.findByRole('link', { name: 'Summer Tapas' });
    expect(draftLink).toHaveAttribute('href', '/review/draft-1');
    // A published contest opens its activity log.
    expect(screen.getByRole('link', { name: 'Balcony Cook-off' })).toHaveAttribute('href', '/contest/live-1');
  });

  it('offers a way to start a new contest', async () => {
    vi.mocked(api.listContests).mockResolvedValue([summary({ id: 'a', name: 'Balcony Cook-off', status: 'live' })]);
    renderApp();

    const newContest = await screen.findByRole('link', { name: 'New contest' });
    expect(newContest).toHaveAttribute('href', '/new');
  });

  it('invites a host with no contests to create their first', async () => {
    vi.mocked(api.listContests).mockResolvedValue([]);
    renderApp();

    expect(await screen.findByText(/don’t have any contests yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create your first contest' })).toHaveAttribute('href', '/new');
  });

  it('announces a load failure without crashing', async () => {
    vi.mocked(api.listContests).mockRejectedValue(new Error('network'));
    renderApp();

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t be loaded/i);
  });

  it('has no accessibility violations', async () => {
    vi.mocked(api.listContests).mockResolvedValue([
      summary({ id: 'a', name: 'Balcony Cook-off', status: 'live' }),
      summary({ id: 'b', name: 'Summer Tapas', status: 'draft' }),
    ]);
    const { container } = renderApp();

    await screen.findByRole('table', { name: 'Your contests' });
    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * What a host can read off a row without opening the contest.
 *
 * The distinction these tests exist to protect: what a contest cannot have yet is
 * *absent*, never zero. "Not published" and "nobody has voted" are different
 * facts, and a host skimming the list must not have to tell them apart by
 * guessing.
 */
describe('How each contest is going', () => {
  beforeEach(() => {
    vi.mocked(api.whoAmI).mockResolvedValue({ hostId: 'h1', role: 'host' });
  });
  afterEach(() => vi.clearAllMocks());

  const rowFor = (name: string) =>
    screen.getAllByRole('row').find((row) => row.textContent?.includes(name))!;

  it('says how far along a live contest is, in words as well as a bar', async () => {
    vi.mocked(api.listContests).mockResolvedValue([
      summary({
        id: 'a',
        name: 'Spring Tapas Crawl',
        status: 'live',
        progress: { claimedCount: 18, draftCount: 5, sentCount: 13 },
      }),
    ]);
    renderApp();

    await screen.findByRole('table', { name: 'Your contests' });
    expect(rowFor('Spring Tapas Crawl')).toHaveTextContent('13 of 18 votes sent');
  });

  it('says nobody has joined rather than drawing an empty bar', async () => {
    vi.mocked(api.listContests).mockResolvedValue([
      summary({
        id: 'a',
        name: 'Nobody Yet',
        status: 'live',
        progress: { claimedCount: 0, draftCount: 0, sentCount: 0 },
      }),
    ]);
    renderApp();

    await screen.findByRole('table', { name: 'Your contests' });
    expect(rowFor('Nobody Yet')).toHaveTextContent('Nobody has joined yet');
    expect(rowFor('Nobody Yet')).not.toHaveTextContent('votes sent');
  });

  it('shows what a contest is judged on, and the code people join with', async () => {
    vi.mocked(api.listContests).mockResolvedValue([
      summary({
        id: 'a',
        name: 'Spring Tapas Crawl',
        status: 'live',
        attribution: 'per_person',
        categoryCount: 4,
        joinCode: '4KQ-207',
        progress: { claimedCount: 1, draftCount: 0, sentCount: 1 },
      }),
    ]);
    renderApp();

    await screen.findByRole('table', { name: 'Your contests' });
    expect(rowFor('Spring Tapas Crawl')).toHaveTextContent(
      'Per person · 4 categories · code 4KQ-207',
    );
  });

  it('counts a single category in the singular', async () => {
    vi.mocked(api.listContests).mockResolvedValue([
      summary({ id: 'a', name: 'One Thing', status: 'draft', categoryCount: 1 }),
    ]);
    renderApp();

    await screen.findByRole('table', { name: 'Your contests' });
    expect(rowFor('One Thing')).toHaveTextContent('1 category');
  });

  it('says a contest being prepared is not published, not that nobody voted', async () => {
    vi.mocked(api.listContests).mockResolvedValue([
      summary({ id: 'a', name: 'Barrio Supper Club', status: 'draft' }),
    ]);
    renderApp();

    await screen.findByRole('table', { name: 'Your contests' });
    const row = rowFor('Barrio Supper Club');
    expect(row).toHaveTextContent('Not published');
    expect(row).not.toHaveTextContent('votes sent');
    expect(row).not.toHaveTextContent('Nobody has joined yet');
  });

  it('says nothing at all about the rules of a draft that has none', async () => {
    vi.mocked(api.listContests).mockResolvedValue([
      summary({ id: 'a', name: 'Just A Name', status: 'draft' }),
    ]);
    renderApp();

    await screen.findByRole('table', { name: 'Your contests' });
    const row = rowFor('Just A Name');
    expect(row).not.toHaveTextContent('categor');
    expect(row).not.toHaveTextContent('code');
  });

  it('says a revealed contest’s results are public', async () => {
    vi.mocked(api.listContests).mockResolvedValue([
      summary({
        id: 'a',
        name: 'Winter Tapeo',
        status: 'revealed',
        progress: { claimedCount: 4, draftCount: 0, sentCount: 4 },
      }),
    ]);
    renderApp();

    await screen.findByRole('table', { name: 'Your contests' });
    expect(rowFor('Winter Tapeo')).toHaveTextContent('Results public');
  });

  it('still shows what was sent once voting has closed', async () => {
    vi.mocked(api.listContests).mockResolvedValue([
      summary({
        id: 'a',
        name: 'Pintxos Night',
        status: 'closed',
        progress: { claimedCount: 16, draftCount: 0, sentCount: 16 },
      }),
    ]);
    renderApp();

    await screen.findByRole('table', { name: 'Your contests' });
    expect(rowFor('Pintxos Night')).toHaveTextContent('16 of 16 votes sent');
  });

  it('has no accessibility violations with progress on the rows', async () => {
    vi.mocked(api.listContests).mockResolvedValue([
      summary({
        id: 'a',
        name: 'Spring Tapas Crawl',
        status: 'live',
        attribution: 'per_person',
        categoryCount: 4,
        joinCode: '4KQ-207',
        progress: { claimedCount: 18, draftCount: 5, sentCount: 13 },
      }),
      summary({ id: 'b', name: 'Barrio Supper Club', status: 'draft' }),
    ]);
    const { container } = renderApp();

    await screen.findByRole('table', { name: 'Your contests' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
