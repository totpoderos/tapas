import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app';
import { SessionProvider } from '../../src/auth/session';
import type { ContestSummary } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, hasSession: vi.fn(), signOut: vi.fn(), listContests: vi.fn() };
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
    vi.mocked(api.hasSession).mockResolvedValue(true); // a signed-in host
  });
  afterEach(() => vi.clearAllMocks());

  it('lists each contest with its status as a readable word', async () => {
    vi.mocked(api.listContests).mockResolvedValue([
      summary({ id: 'a', name: 'Balcony Cook-off', status: 'live' }),
      summary({ id: 'b', name: 'Summer Tapas', status: 'draft' }),
      summary({ id: 'c', name: 'Winter Feast', status: 'revealed' }),
      summary({ id: 'd', name: 'Rooftop Rounds', status: 'closed' }),
    ]);

    renderApp();

    const list = await screen.findByRole('list', { name: 'Your contests' });
    const [live, draft, revealed, closed] = within(list).getAllByRole('listitem');
    expect(within(live!).getByText('Balcony Cook-off')).toBeInTheDocument();
    expect(within(live!).getByText('Live')).toBeInTheDocument();
    expect(within(draft!).getByText('Draft')).toBeInTheDocument();
    expect(within(revealed!).getByText('Revealed')).toBeInTheDocument();
    expect(within(closed!).getByText('Closed')).toBeInTheDocument();
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

    await screen.findByRole('list', { name: 'Your contests' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
