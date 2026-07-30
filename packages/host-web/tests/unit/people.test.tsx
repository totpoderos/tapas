import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app';
import { SessionProvider } from '../../src/auth/session';
import { ApiError } from '../../src/api/client';

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
    inviteHost: vi.fn(),
    revokeInvitation: vi.fn(),
    resendInvitation: vi.fn(),
  };
});
import * as api from '../../src/api/client';

const ADMINISTRATOR = { hostId: 'a1', role: 'admin' as const };
const HOST = { hostId: 'h1', role: 'host' as const };

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </MemoryRouter>,
  );
}

/** The row a person occupies, found by the cell carrying their address. */
function rowFor(email: string): HTMLElement {
  return screen.getByRole('cell', { name: email }).closest('tr')!;
}

/** How many rows an address occupies — one, always, is the point of the join. */
function rowsFor(email: string): number {
  return screen.queryAllByRole('cell', { name: email }).length;
}

describe('The people in a deployment', () => {
  beforeEach(() => {
    vi.mocked(api.whoAmI).mockResolvedValue(ADMINISTRATOR);
    vi.mocked(api.isDeploymentUnclaimed).mockResolvedValue(false);
    vi.mocked(api.listContests).mockResolvedValue([]);
    vi.mocked(api.listHostAccounts).mockReset();
    vi.mocked(api.listInvitations).mockReset();
    vi.mocked(api.inviteHost).mockReset();
    vi.mocked(api.revokeInvitation).mockReset();
    vi.mocked(api.resendInvitation).mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it('shows an account and the invitation it came from as one row', async () => {
    vi.mocked(api.listHostAccounts).mockResolvedValue([
      { email: 'bob@sobremesa.es', isAdministrator: false },
    ]);
    vi.mocked(api.listInvitations).mockResolvedValue([
      { id: 'i1', email: 'bob@sobremesa.es', status: 'accepted', issuedAt: '2026-07-01T10:00:00Z' },
    ]);
    renderAt('/people');

    await screen.findByRole('cell', { name: 'bob@sobremesa.es' });
    expect(rowsFor('bob@sobremesa.es')).toBe(1);
    expect(rowFor('bob@sobremesa.es')).toHaveTextContent('Host');
  });

  it('shows only the newest invitation for an address that has no account', async () => {
    // Resending leaves the older one superseded. "Newest" makes it disappear
    // without anything following the chain.
    vi.mocked(api.listHostAccounts).mockResolvedValue([]);
    vi.mocked(api.listInvitations).mockResolvedValue([
      { id: 'i1', email: 'nuevo@sobremesa.es', status: 'superseded', issuedAt: '2026-07-01T10:00:00Z' },
      { id: 'i2', email: 'nuevo@sobremesa.es', status: 'pending', issuedAt: '2026-07-02T10:00:00Z' },
    ]);
    renderAt('/people');

    await screen.findByRole('cell', { name: 'nuevo@sobremesa.es' });
    expect(rowsFor('nuevo@sobremesa.es')).toBe(1);
    expect(rowFor('nuevo@sobremesa.es')).toHaveTextContent('Invited');
  });

  it('shows an administrator as one', async () => {
    vi.mocked(api.listHostAccounts).mockResolvedValue([
      { email: 'ana@sobremesa.es', isAdministrator: true },
    ]);
    vi.mocked(api.listInvitations).mockResolvedValue([]);
    renderAt('/people');

    await screen.findByRole('cell', { name: 'ana@sobremesa.es' });
    expect(rowFor('ana@sobremesa.es')).toHaveTextContent('Administrator');
  });

  it('offers revoke and resend on an invitation, and neither on an account', async () => {
    vi.mocked(api.listHostAccounts).mockResolvedValue([
      { email: 'bob@sobremesa.es', isAdministrator: false },
    ]);
    vi.mocked(api.listInvitations).mockResolvedValue([
      { id: 'i2', email: 'nuevo@sobremesa.es', status: 'pending', issuedAt: '2026-07-02T10:00:00Z' },
    ]);
    renderAt('/people');

    await screen.findByRole('cell', { name: 'bob@sobremesa.es' });
    const invited = within(rowFor('nuevo@sobremesa.es'));
    expect(invited.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
    expect(invited.getByRole('button', { name: 'Resend' })).toBeInTheDocument();

    const account = within(rowFor('bob@sobremesa.es'));
    expect(account.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    expect(account.queryByRole('button', { name: 'Resend' })).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.mocked(api.listHostAccounts).mockResolvedValue([
      { email: 'ana@sobremesa.es', isAdministrator: true },
    ]);
    vi.mocked(api.listInvitations).mockResolvedValue([
      { id: 'i2', email: 'nuevo@sobremesa.es', status: 'pending', issuedAt: '2026-07-02T10:00:00Z' },
    ]);
    const { container } = renderAt('/people');

    await screen.findByRole('cell', { name: 'ana@sobremesa.es' });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Inviting from the screen', () => {
  beforeEach(() => {
    vi.mocked(api.whoAmI).mockResolvedValue(ADMINISTRATOR);
    vi.mocked(api.isDeploymentUnclaimed).mockResolvedValue(false);
    vi.mocked(api.listContests).mockResolvedValue([]);
    vi.mocked(api.listHostAccounts).mockResolvedValue([]);
    vi.mocked(api.listInvitations).mockResolvedValue([]);
    vi.mocked(api.inviteHost).mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it('adds the person to the list', async () => {
    vi.mocked(api.inviteHost).mockResolvedValue({ invitationId: 'i9', messageSent: true });
    renderAt('/people');
    await screen.findByRole('heading', { name: 'People' });

    vi.mocked(api.listInvitations).mockResolvedValue([
      { id: 'i9', email: 'nuevo@sobremesa.es', status: 'pending', issuedAt: '2026-07-02T10:00:00Z' },
    ]);
    await userEvent.type(screen.getByLabelText('Email'), 'nuevo@sobremesa.es');
    await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(api.inviteHost).toHaveBeenCalledWith('nuevo@sobremesa.es');
    expect(await screen.findByRole('cell', { name: 'nuevo@sobremesa.es' })).toBeInTheDocument();
    expect(rowFor('nuevo@sobremesa.es')).toHaveTextContent('Invited');
  });

  it('shows the link once when the message could not be sent, and never in the list', async () => {
    const link = 'http://localhost:5173/accept-invite/the-token';
    vi.mocked(api.inviteHost).mockResolvedValue({ invitationId: 'i9', messageSent: false, link });
    renderAt('/people');
    await screen.findByRole('heading', { name: 'People' });

    vi.mocked(api.listInvitations).mockResolvedValue([
      { id: 'i9', email: 'nuevo@sobremesa.es', status: 'pending', issuedAt: '2026-07-02T10:00:00Z' },
    ]);
    await userEvent.type(screen.getByLabelText('Email'), 'nuevo@sobremesa.es');
    await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText(link)).toBeInTheDocument();
    // Nothing stores it, so the row cannot carry it — and must not look as if it could.
    await screen.findByRole('cell', { name: 'nuevo@sobremesa.es' });
    expect(rowFor('nuevo@sobremesa.es')).not.toHaveTextContent('the-token');
  });

  it('refuses an address that already has an account, on the form', async () => {
    vi.mocked(api.inviteHost).mockRejectedValue(new ApiError(409, 'EMAIL_TAKEN'));
    renderAt('/people');
    await screen.findByRole('heading', { name: 'People' });

    await userEvent.type(screen.getByLabelText('Email'), 'bob@sobremesa.es');
    await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already registered/i);
  });
});

describe('Who is offered the way in', () => {
  beforeEach(() => {
    vi.mocked(api.isDeploymentUnclaimed).mockResolvedValue(false);
    vi.mocked(api.listContests).mockResolvedValue([]);
    vi.mocked(api.listHostAccounts).mockResolvedValue([]);
    vi.mocked(api.listInvitations).mockResolvedValue([]);
  });
  afterEach(() => vi.clearAllMocks());

  // The two kinds of work do not mix in the panel: an administrator's is
  // administration, a host's is their contests, and neither is offered the
  // other's. The API is unaffected — it still decides on every request, and an
  // administrator keeps a host's powers there.
  it('puts an administrator on the people, with nothing of a host’s offered', async () => {
    vi.mocked(api.whoAmI).mockResolvedValue(ADMINISTRATOR);
    renderAt('/');

    expect(await screen.findByRole('heading', { name: 'People' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'All contests' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Assistant' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New contest' })).not.toBeInTheDocument();
  });

  it('offers a host nothing of the kind', async () => {
    vi.mocked(api.whoAmI).mockResolvedValue(HOST);
    renderAt('/');

    await screen.findByRole('heading', { name: 'Your contests' });
    expect(screen.queryByRole('link', { name: 'People & access' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'People' })).not.toBeInTheDocument();
  });

  it('tells a host who reaches the screen anyway, and leaves them there', async () => {
    vi.mocked(api.whoAmI).mockResolvedValue(HOST);
    vi.mocked(api.listHostAccounts).mockRejectedValue(new ApiError(403, 'NOT_ALLOWED'));
    vi.mocked(api.listInvitations).mockRejectedValue(new ApiError(403, 'NOT_ALLOWED'));
    renderAt('/people');

    // Told, not moved — the previous slice locked hosts out of a usable screen
    // by redirecting on server state.
    expect(
      await screen.findByRole('heading', { name: 'This screen is not for you' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your contests' })).not.toBeInTheDocument();
  });

  it('shows a refused host nobody else', async () => {
    vi.mocked(api.whoAmI).mockResolvedValue(HOST);
    vi.mocked(api.listHostAccounts).mockRejectedValue(new ApiError(403, 'NOT_ALLOWED'));
    vi.mocked(api.listInvitations).mockRejectedValue(new ApiError(403, 'NOT_ALLOWED'));
    renderAt('/people');

    await screen.findByRole('heading', { name: 'This screen is not for you' });
    expect(document.body.textContent).not.toMatch(/@/);
  });
});
