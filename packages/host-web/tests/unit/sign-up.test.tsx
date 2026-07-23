import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app';
import { SessionProvider } from '../../src/auth/session';
import { ApiError } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, hasSession: vi.fn(), register: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
});
import * as api from '../../src/api/client';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('Host sign-up', () => {
  beforeEach(() => {
    vi.mocked(api.hasSession).mockResolvedValue(false);
    vi.mocked(api.register).mockReset();
    vi.mocked(api.signIn).mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it('creates an account, signs in, and lands on home', async () => {
    vi.mocked(api.register).mockResolvedValue();
    vi.mocked(api.signIn).mockResolvedValue();
    renderAt('/sign-up');

    await screen.findByRole('heading', { name: 'Create your account' });
    await userEvent.type(screen.getByLabelText('Email'), 'new@sobremesa.es');
    await userEvent.type(screen.getByLabelText('Password'), 'Str0ng!Passw0rd');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(api.register).toHaveBeenCalledWith('new@sobremesa.es', 'Str0ng!Passw0rd');
    expect(api.signIn).toHaveBeenCalledWith('new@sobremesa.es', 'Str0ng!Passw0rd');
    expect(await screen.findByRole('heading', { name: 'You’re signed in' })).toBeInTheDocument();
  });

  it('shows a form notice when the email is already registered', async () => {
    vi.mocked(api.register).mockRejectedValue(new ApiError(409, 'EMAIL_TAKEN'));
    renderAt('/sign-up');

    await screen.findByRole('heading', { name: 'Create your account' });
    await userEvent.type(screen.getByLabelText('Email'), 'taken@sobremesa.es');
    await userEvent.type(screen.getByLabelText('Password'), 'Str0ng!Passw0rd');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already registered/i);
    expect(api.signIn).not.toHaveBeenCalled();
  });

  it('announces a weak password on the password field', async () => {
    vi.mocked(api.register).mockRejectedValue(new ApiError(400, 'WEAK_PASSWORD'));
    renderAt('/sign-up');

    await screen.findByRole('heading', { name: 'Create your account' });
    await userEvent.type(screen.getByLabelText('Email'), 'new@sobremesa.es');
    await userEvent.type(screen.getByLabelText('Password'), 'weak');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 12 characters/i);
  });

  it('has no accessibility violations on the sign-up screen', async () => {
    const { container } = renderAt('/sign-up');
    await screen.findByRole('heading', { name: 'Create your account' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
