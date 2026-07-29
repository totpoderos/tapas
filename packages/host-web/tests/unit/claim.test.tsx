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
    isDeploymentUnclaimed: vi.fn(),
    claimDeployment: vi.fn(),
  };
});
import * as api from '../../src/api/client';

const OPERATOR = 'operator@sobremesa.es';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('Claiming a deployment', () => {
  beforeEach(() => {
    vi.mocked(api.hasSession).mockResolvedValue(false);
    vi.mocked(api.listContests).mockResolvedValue([]);
    vi.mocked(api.isDeploymentUnclaimed).mockReset();
    vi.mocked(api.claimDeployment).mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it('offers to be claimed when nobody has', async () => {
    vi.mocked(api.isDeploymentUnclaimed).mockResolvedValue(true);
    renderAt('/claim');

    expect(
      await screen.findByRole('heading', { name: 'Set up this deployment' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('sends them to their inbox once the message went out', async () => {
    vi.mocked(api.isDeploymentUnclaimed).mockResolvedValue(true);
    vi.mocked(api.claimDeployment).mockResolvedValue({ messageSent: true });
    renderAt('/claim');

    await screen.findByLabelText('Email');
    await userEvent.type(screen.getByLabelText('Email'), OPERATOR);
    await userEvent.click(screen.getByRole('button', { name: 'Claim it' }));

    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
    expect(api.claimDeployment).toHaveBeenCalledWith(OPERATOR);
  });

  it('shows the link, and does not mention an inbox, when the message could not be sent', async () => {
    // The ordinary first-deploy path when mail is not configured yet — and the
    // one moment in this system when nobody exists who could resend.
    vi.mocked(api.isDeploymentUnclaimed).mockResolvedValue(true);
    vi.mocked(api.claimDeployment).mockResolvedValue({
      messageSent: false,
      link: 'http://localhost:5173/accept-invite/the-token',
    });
    renderAt('/claim');

    await screen.findByLabelText('Email');
    await userEvent.type(screen.getByLabelText('Email'), OPERATOR);
    await userEvent.click(screen.getByRole('button', { name: 'Claim it' }));

    expect(
      await screen.findByText('http://localhost:5173/accept-invite/the-token'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Check your inbox' })).not.toBeInTheDocument();
  });

  it('refuses another address without saying which would have worked', async () => {
    vi.mocked(api.isDeploymentUnclaimed).mockResolvedValue(true);
    vi.mocked(api.claimDeployment).mockRejectedValue(new ApiError(403, 'CLAIM_REFUSED'));
    renderAt('/claim');

    await screen.findByLabelText('Email');
    await userEvent.type(screen.getByLabelText('Email'), 'someone-else@sobremesa.es');
    await userEvent.click(screen.getByRole('button', { name: 'Claim it' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(OPERATOR);
  });

  it('says so plainly once the deployment has an administrator', async () => {
    vi.mocked(api.isDeploymentUnclaimed).mockResolvedValue(false);
    renderAt('/claim');

    expect(
      await screen.findByRole('heading', { name: 'This deployment already has an administrator' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.mocked(api.isDeploymentUnclaimed).mockResolvedValue(true);
    const { container } = renderAt('/claim');

    await screen.findByLabelText('Email');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Sign-in on a deployment nobody has claimed', () => {
  beforeEach(() => {
    vi.mocked(api.listContests).mockResolvedValue([]);
    vi.mocked(api.isDeploymentUnclaimed).mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it('still lets a host sign in, and offers the way to set it up', async () => {
    // An earlier version redirected here, which locked out every host on a
    // deployment that has accounts but no administrator — the state every
    // deployment is in until open registration is removed.
    vi.mocked(api.hasSession).mockResolvedValue(false);
    vi.mocked(api.isDeploymentUnclaimed).mockResolvedValue(true);
    renderAt('/sign-in');

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set it up' })).toBeInTheDocument();
  });

  it('says nothing about setting up when the deployment is claimed', async () => {
    vi.mocked(api.hasSession).mockResolvedValue(false);
    vi.mocked(api.isDeploymentUnclaimed).mockResolvedValue(false);
    renderAt('/sign-in');

    await screen.findByRole('heading', { name: 'Welcome back' });
    expect(screen.queryByRole('link', { name: 'Set it up' })).not.toBeInTheDocument();
  });

  it('costs a signed-in host nothing to find out', async () => {
    // The question only changes where an anonymous visitor goes, so only they
    // should pay for the answer.
    vi.mocked(api.hasSession).mockResolvedValue(true);
    renderAt('/');

    await screen.findByRole('heading', { name: 'Your contests' });
    expect(api.isDeploymentUnclaimed).not.toHaveBeenCalled();
  });
});
