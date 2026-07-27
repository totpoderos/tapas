import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app';
import { SessionProvider } from '../../src/auth/session';
import { ApiError } from '../../src/api/client';

expect.extend(toHaveNoViolations);

// The page's door to the API — mocked so these tests never touch the network.
vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return {
    ...actual,
    hasSession: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    listContests: vi.fn(),
  };
});
import * as api from '../../src/api/client';

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('Host sign-in', () => {
  beforeEach(() => {
    vi.mocked(api.hasSession).mockResolvedValue(false); // start anonymous
    vi.mocked(api.signIn).mockReset();
    vi.mocked(api.listContests).mockResolvedValue([]);
  });
  afterEach(() => vi.clearAllMocks());

  it('shows the sign-in screen to an anonymous visitor', async () => {
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('signs in with the right credentials and lands on home', async () => {
    vi.mocked(api.signIn).mockResolvedValue();
    renderApp();

    await screen.findByRole('heading', { name: 'Welcome back' });
    await userEvent.type(screen.getByLabelText('Email'), 'host@sobremesa.es');
    await userEvent.type(screen.getByLabelText('Password'), 'Str0ng!Passw0rd');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(api.signIn).toHaveBeenCalledWith('host@sobremesa.es', 'Str0ng!Passw0rd');
    expect(await screen.findByRole('heading', { name: 'Your contests' })).toBeInTheDocument();
  });

  it('announces an error and stays on the sign-in screen when the password is wrong', async () => {
    vi.mocked(api.signIn).mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS'));
    renderApp();

    await screen.findByRole('heading', { name: 'Welcome back' });
    await userEvent.type(screen.getByLabelText('Email'), 'host@sobremesa.es');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/don’t match/i);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('remembers a signed-in host across a reload (a valid cookie means home)', async () => {
    vi.mocked(api.hasSession).mockResolvedValue(true);
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Your contests' })).toBeInTheDocument();
  });

  it('has no accessibility violations on the sign-in screen', async () => {
    const { container } = renderApp();
    await screen.findByRole('heading', { name: 'Welcome back' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
