import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app';
import { SessionProvider } from '../../src/auth/session';

/**
 * The defect as a host meets it: leave the app open past the access token's
 * quarter of an hour, come back, and be put on sign-in — with a refresh token
 * still in the browser, good for another seven days, that nothing spent.
 *
 * Driven through a stubbed `fetch` rather than a mocked client, because the
 * renewal lives in the client and mocking it away would mock away the fix.
 */

let fetchStub: ReturnType<typeof vi.fn>;

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const agedOut = () =>
  new Response(JSON.stringify({ error: { code: 'NOT_SIGNED_IN' } }), { status: 401 });

describe('A host returning to a left-open app', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('is still signed in, and lands on their contests', async () => {
    let asked = 0;
    fetchStub = vi.fn((url: string) => {
      if (url === '/auth/refresh') return ok({ hostId: 'h1', role: 'host' });
      if (url === '/auth/me') return asked++ === 0 ? agedOut() : ok({ hostId: 'h1', role: 'host' });
      if (url === '/contests') return ok([]);
      return agedOut();
    });
    vi.stubGlobal('fetch', fetchStub);

    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionProvider>
          <App />
        </SessionProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Your contests' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument();
  });

  it('is sent to sign in when the session cannot be renewed at all', async () => {
    // Signed out elsewhere, or left far longer than a session lasts. This is the
    // behaviour that must survive the change, not the one being fixed.
    vi.stubGlobal('fetch', vi.fn(() => agedOut()));

    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionProvider>
          <App />
        </SessionProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});
