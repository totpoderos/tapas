import { render, screen } from '@testing-library/react';
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
    hasSession: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    listContests: vi.fn(),
    readInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
    isDeploymentUnclaimed: vi.fn(),
  };
});
import * as api from '../../src/api/client';

const TOKEN = 'a-token-from-a-real-message';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('Accepting an invitation', () => {
  beforeEach(() => {
    vi.mocked(api.hasSession).mockResolvedValue(false);
    vi.mocked(api.isDeploymentUnclaimed).mockResolvedValue(false);
    vi.mocked(api.listContests).mockResolvedValue([]);
    vi.mocked(api.readInvitation).mockReset();
    vi.mocked(api.acceptInvitation).mockReset();
    vi.mocked(api.signIn).mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it('names the address the invitation was sent to', async () => {
    vi.mocked(api.readInvitation).mockResolvedValue({ email: 'nuevo@sobremesa.es' });
    renderAt(`/accept-invite/${TOKEN}`);

    expect(await screen.findByText(/nuevo@sobremesa\.es/)).toBeInTheDocument();
    expect(api.readInvitation).toHaveBeenCalledWith(TOKEN);
  });

  it('finishes the account and lands them on their own contests', async () => {
    vi.mocked(api.readInvitation).mockResolvedValue({ email: 'nuevo@sobremesa.es' });
    vi.mocked(api.acceptInvitation).mockResolvedValue();
    vi.mocked(api.signIn).mockResolvedValue();
    renderAt(`/accept-invite/${TOKEN}`);

    await screen.findByText(/nuevo@sobremesa\.es/);
    await userEvent.type(screen.getByLabelText('Password'), 'Str0ng!Passw0rd');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));

    expect(api.acceptInvitation).toHaveBeenCalledWith(TOKEN, 'Str0ng!Passw0rd');
    expect(api.signIn).toHaveBeenCalledWith('nuevo@sobremesa.es', 'Str0ng!Passw0rd');
    expect(await screen.findByRole('heading', { name: 'Your contests' })).toBeInTheDocument();
  });

  it('refuses a weak password on the field, leaving the link usable', async () => {
    vi.mocked(api.readInvitation).mockResolvedValue({ email: 'nuevo@sobremesa.es' });
    vi.mocked(api.acceptInvitation).mockRejectedValue(new ApiError(400, 'WEAK_PASSWORD'));
    renderAt(`/accept-invite/${TOKEN}`);

    await screen.findByText(/nuevo@sobremesa\.es/);
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // Still on the form, still able to try again — a mistyped password must not
    // cost somebody their only way in.
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set password' })).toBeEnabled();
  });

  describe('when the link cannot be used', () => {
    beforeEach(() => {
      vi.mocked(api.readInvitation).mockRejectedValue(new ApiError(404, 'INVITATION_UNUSABLE'));
    });

    it('says so, and says what to do about it', async () => {
      renderAt(`/accept-invite/${TOKEN}`);

      expect(
        await screen.findByRole('heading', { name: 'This link cannot be used' }),
      ).toBeInTheDocument();
      expect(screen.getByText(/ask whoever invited you/i)).toBeInTheDocument();
    });

    it('offers no way to choose a password', async () => {
      renderAt(`/accept-invite/${TOKEN}`);

      await screen.findByRole('heading', { name: 'This link cannot be used' });
      expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    });

    it('names nobody', async () => {
      renderAt(`/accept-invite/${TOKEN}`);

      await screen.findByRole('heading', { name: 'This link cannot be used' });
      expect(document.body.textContent).not.toMatch(/@/);
    });

    it('reads the same whatever the reason was', async () => {
      // The API answers identically for unknown, accepted, expired, revoked and
      // superseded. The screen is given nothing to tell them apart with, and
      // must not appear to.
      const used = renderAt(`/accept-invite/${TOKEN}`);
      await screen.findByRole('heading', { name: 'This link cannot be used' });
      const first = used.container.textContent;
      used.unmount();

      const expired = renderAt('/accept-invite/a-different-dead-token');
      await screen.findByRole('heading', { name: 'This link cannot be used' });

      expect(expired.container.textContent).toBe(first);
    });
  });

  it('says the account is ready when only the sign-in that follows was refused', async () => {
    vi.mocked(api.readInvitation).mockResolvedValue({ email: 'nuevo@sobremesa.es' });
    vi.mocked(api.acceptInvitation).mockResolvedValue();
    // The sensitive rate limit refuses the second leg. The account exists and
    // the link is spent, so "try again" would send them back to a dead link.
    vi.mocked(api.signIn).mockRejectedValue(new ApiError(429, 'RATE_LIMITED'));
    renderAt(`/accept-invite/${TOKEN}`);

    await screen.findByText(/nuevo@sobremesa\.es/);
    await userEvent.type(screen.getByLabelText('Password'), 'Str0ng!Passw0rd');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));

    expect(
      await screen.findByRole('heading', { name: 'Your account is ready' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/went wrong|try again/i);
  });

  it('has no accessibility violations, on either state', async () => {
    vi.mocked(api.readInvitation).mockResolvedValue({ email: 'nuevo@sobremesa.es' });
    const usable = renderAt(`/accept-invite/${TOKEN}`);
    await screen.findByText(/nuevo@sobremesa\.es/);
    expect(await axe(usable.container)).toHaveNoViolations();
    usable.unmount();

    vi.mocked(api.readInvitation).mockRejectedValue(new ApiError(404, 'INVITATION_UNUSABLE'));
    const refused = renderAt(`/accept-invite/${TOKEN}`);
    await screen.findByRole('heading', { name: 'This link cannot be used' });
    expect(await axe(refused.container)).toHaveNoViolations();
  });
});
