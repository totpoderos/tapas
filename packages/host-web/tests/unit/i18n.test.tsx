import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app';
import { SessionProvider } from '../../src/auth/session';
import { i18n } from '../../src/i18n';

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, hasSession: vi.fn(), listContests: vi.fn() };
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

describe('Host app translation', () => {
  beforeEach(() => {
    vi.mocked(api.hasSession).mockResolvedValue(false); // anonymous → sign-in screen
    vi.mocked(api.listContests).mockResolvedValue([]);
  });
  afterEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en'); // don't leak the language into other suites
  });

  it('renders the interface in English by default', async () => {
    await i18n.changeLanguage('en');
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('renders the whole interface in Spanish when Spanish is chosen', async () => {
    await i18n.changeLanguage('es');
    renderApp();

    // Heading, helper text and the submit button all come through in Spanish.
    expect(await screen.findByRole('heading', { name: 'Bienvenido de nuevo' })).toBeInTheDocument();
    expect(screen.getByText('Inicia sesión para gestionar tus concursos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});
