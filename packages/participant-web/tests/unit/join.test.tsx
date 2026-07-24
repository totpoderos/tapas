import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app';
import { ApiError, type Identity, type OpenPlaces } from '../../src/api/client';

expect.extend(toHaveNoViolations);

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return { ...actual, getPlaces: vi.fn(), claimPlace: vi.fn(), getMe: vi.fn() };
});
import * as api from '../../src/api/client';

/** A minimal in-memory localStorage — jsdom's here doesn't implement it fully. */
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
    { participantId: 'A', displayName: 'Ana' },
    { participantId: 'B', displayName: 'Bruno' },
  ],
};
const ANA: Identity = { participantId: 'A', contestId: 'c1', displayName: 'Ana' };

function renderAt(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('Participant join', () => {
  beforeEach(() => {
    stubLocalStorage();
    vi.mocked(api.getMe).mockReset().mockResolvedValue(null);
    vi.mocked(api.getPlaces).mockReset().mockResolvedValue(PLACES);
    vi.mocked(api.claimPlace).mockReset().mockResolvedValue(ANA);
  });
  afterEach(() => vi.clearAllMocks());

  it('joins by entering a code and choosing a name', async () => {
    renderAt('/');

    await userEvent.type(await screen.findByLabelText('Join code'), 'ABC123');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(api.getPlaces).toHaveBeenCalledWith('ABC123');
    await userEvent.click(await screen.findByRole('button', { name: 'Ana' }));

    expect(api.claimPlace).toHaveBeenCalledWith('ABC123', 'A');
    expect(await screen.findByText(/you.re in, ana/i)).toBeInTheDocument();
    expect(localStorage.getItem('tapas.contestId')).toBe('c1');
  });

  it('refuses an unrecognised code', async () => {
    vi.mocked(api.getPlaces).mockRejectedValue(new ApiError(404, 'JOIN_CODE_NOT_FOUND'));
    renderAt('/');

    await userEvent.type(await screen.findByLabelText('Join code'), 'NOPE');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/isn.t recognised/i);
    expect(api.claimPlace).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Join code')).toBeInTheDocument();
  });

  it('tells the joiner when a place was just taken and refreshes the list', async () => {
    vi.mocked(api.claimPlace).mockRejectedValue(new ApiError(409, 'PLACE_TAKEN'));
    vi.mocked(api.getPlaces)
      .mockResolvedValueOnce(PLACES)
      .mockResolvedValueOnce({ contestId: 'c1', places: [{ participantId: 'B', displayName: 'Bruno' }] });
    renderAt('/');

    await userEvent.type(await screen.findByLabelText('Join code'), 'ABC123');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ana' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/just taken/i);
    // The list refreshed: Ana is gone, Bruno remains.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Ana' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Bruno' })).toBeInTheDocument();
  });

  it('remembers a returning participant on this device, without the code', async () => {
    localStorage.setItem('tapas.contestId', 'c1');
    vi.mocked(api.getMe).mockResolvedValue(ANA);
    renderAt('/');

    expect(await screen.findByText(/you.re in, ana/i)).toBeInTheDocument();
    expect(api.getMe).toHaveBeenCalledWith('c1');
    expect(api.getPlaces).not.toHaveBeenCalled();
  });

  it('opens straight to the places for a deep link', async () => {
    renderAt('/j/DEEP99');

    expect(await screen.findByRole('button', { name: 'Ana' })).toBeInTheDocument();
    expect(api.getPlaces).toHaveBeenCalledWith('DEEP99');
  });

  it('has no accessibility violations on the code screen', async () => {
    const { container } = renderAt('/');
    await screen.findByLabelText('Join code');
    expect(await axe(container)).toHaveNoViolations();
  });
});
