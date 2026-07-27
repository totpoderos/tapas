import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app';
import { i18n } from '../../src/i18n';
import type { OpenPlaces } from '../../src/api/client';

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, getPlaces: vi.fn(), claimPlace: vi.fn(), getMe: vi.fn(), getDishes: vi.fn() };
});
import * as api from '../../src/api/client';

function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
}

const PLACES: OpenPlaces = {
  contestId: 'c1',
  places: [
    { participantId: 'a', displayName: 'Ana' },
    { participantId: 'b', displayName: 'Bruno' },
  ],
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('Participant app translation', () => {
  beforeEach(() => {
    stubLocalStorage();
    vi.mocked(api.getMe).mockReset().mockResolvedValue(null);
    vi.mocked(api.getPlaces).mockReset().mockResolvedValue(PLACES);
  });
  afterEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en'); // don't leak the language into other suites
  });

  it('renders the interface in English by default', async () => {
    await i18n.changeLanguage('en');
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Join the contest' })).toBeInTheDocument();
    expect(screen.getByLabelText('Join code')).toBeInTheDocument();
  });

  it('renders the whole screen in Spanish when Spanish is chosen', async () => {
    await i18n.changeLanguage('es');
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Únete al concurso' })).toBeInTheDocument();
    expect(screen.getByText('Introduce el código que te dio el anfitrión.')).toBeInTheDocument();
    expect(screen.getByLabelText('Código de acceso')).toBeInTheDocument();
  });

  // The spec's "data is not translated" requirement: the names people chose are
  // theirs, and read the same whatever the interface language is.
  it('leaves the names people chose in their own words', async () => {
    await i18n.changeLanguage('es');
    renderAt('/j/CODE123');

    // Interface chrome is Spanish…
    expect(await screen.findByRole('heading', { name: '¿Quién eres?' })).toBeInTheDocument();
    // …while the participants' own names are untouched.
    expect(screen.getByRole('button', { name: 'Ana' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bruno' })).toBeInTheDocument();
  });
});
