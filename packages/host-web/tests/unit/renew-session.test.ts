import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, listContests, signIn, whoAmI } from '../../src/api/client';

/**
 * What the host app does when the API says the session has aged out.
 *
 * These drive the real client through a stubbed `fetch`, because the whole
 * point is what happens between the call going out and the caller hearing
 * back — a mocked client module would have nothing to say about it.
 */

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

let fetchStub: ReturnType<typeof vi.fn>;

/** Requests recorded in the order they went out, so a renewal can be counted. */
function pathsCalled(): string[] {
  return fetchStub.mock.calls.map(([url]) => String(url));
}

function renewalsCalled(): number {
  return pathsCalled().filter((path) => path === '/auth/refresh').length;
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const agedOut = () =>
  new Response(JSON.stringify({ error: { code: 'NOT_SIGNED_IN' } }), { status: 401 });

function serve(handler: Handler) {
  fetchStub = vi.fn(handler as never);
  vi.stubGlobal('fetch', fetchStub);
}

/**
 * Answers every request to `path` with the given responses in turn, and the
 * last one for ever after — which is how "aged out, then fine once renewed" is
 * said without counting calls in the test body.
 */
function inTurn(...responses: (() => Response)[]) {
  let call = 0;
  return () => {
    const next = responses[Math.min(call++, responses.length - 1)];
    if (!next) throw new Error('inTurn was given no responses to serve');
    return next();
  };
}

describe('When the session has aged out', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('renews it and carries out the work that found it aged out', async () => {
    const contests = inTurn(agedOut, () => ok([{ id: 'c1', name: 'Sobremesa' }]));
    serve((url) => (url === '/auth/refresh' ? ok({ hostId: 'h1', role: 'host' }) : contests()));

    // The caller is told nothing about any of it: it asked for the contests and
    // it gets the contests.
    await expect(listContests()).resolves.toEqual([{ id: 'c1', name: 'Sobremesa' }]);
    expect(renewalsCalled()).toBe(1);
    expect(pathsCalled()).toEqual(['/contests', '/auth/refresh', '/contests']);
  });

  it('leaves the app knowing who is signed in, so a reload does not reach sign-in', async () => {
    const me = inTurn(agedOut, () => ok({ hostId: 'h1', role: 'admin' }));
    serve((url) => (url === '/auth/refresh' ? ok({ hostId: 'h1', role: 'admin' }) : me()));

    // The read the app makes on mount. Answering `null` here is what sends a
    // host to sign-in, and it is the whole visible defect.
    await expect(whoAmI()).resolves.toEqual({ hostId: 'h1', role: 'admin' });
    expect(renewalsCalled()).toBe(1);
  });

  it('renews once for work that overlaps, not once per piece of work', async () => {
    // The load-bearing one. The API revokes a refresh token as it spends it, so
    // a second renewal raised in the same moment presents something already
    // revoked and ends the session it was raised to save. Any screen that asks
    // for two things at once would hit this.
    const contests = inTurn(agedOut, agedOut, () => ok([]));
    serve((url) => (url === '/auth/refresh' ? ok({ hostId: 'h1', role: 'host' }) : contests()));

    const [first, second] = await Promise.all([listContests(), listContests()]);

    expect(renewalsCalled()).toBe(1);
    expect(first).toEqual([]);
    expect(second).toEqual([]);
  });

  it('reports work still refused after a renewal, rather than renewing again', async () => {
    // A refusal that is not about expiry — work that is not this host's to do,
    // an account whose standing changed — must not renew and retry for ever.
    serve((url) => (url === '/auth/refresh' ? ok({ hostId: 'h1', role: 'host' }) : agedOut()));

    await expect(listContests()).rejects.toBeInstanceOf(ApiError);
    expect(renewalsCalled()).toBe(1);
  });

  it('lets the refusal stand when the session cannot be renewed at all', async () => {
    // Seven days up, or signed out elsewhere. The API clears both cookies as it
    // refuses, so the browser is already in the right state; the app's own paths
    // take it to sign-in from here.
    serve(() => agedOut());

    await expect(listContests()).rejects.toMatchObject({ status: 401 });
    await expect(whoAmI()).resolves.toBeNull();
  });

  it('does not renew for a refused sign-in', async () => {
    // A refused sign-in is a wrong password, not an aged-out session. Renewing
    // here would fire a refresh at every typo.
    serve(() => new Response(JSON.stringify({ error: { code: 'INVALID_CREDENTIALS' } }), { status: 401 }));

    await expect(signIn('ana@sobremesa.es', 'wrong')).rejects.toBeInstanceOf(ApiError);
    expect(renewalsCalled()).toBe(0);
  });

  it('does not renew for a refused renewal', async () => {
    // Otherwise the renewal recurses into itself.
    serve(() => agedOut());

    await expect(listContests()).rejects.toBeInstanceOf(ApiError);
    expect(renewalsCalled()).toBe(1);
  });
});

describe('When another tab is renewing at the same moment', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  /**
   * The promise slot only spans one tab. Two tabs renewing together were
   * measured signing *both* of themselves out: the winner is given fresh
   * cookies, the loser is refused — and the API clears both cookies as it
   * refuses, into a jar the tabs share. The loser's refusal wipes the winner's
   * new session.
   *
   * A browser-wide lock is the same single-flight hoisted out of module scope,
   * so the second tab renews after the first rather than beside it — and by
   * then the cookie it presents is the fresh one, so it is never refused and
   * nothing is cleared.
   */
  it('takes the renewal under a browser-wide lock', async () => {
    const order: string[] = [];
    vi.stubGlobal('navigator', {
      locks: {
        request: async (name: string, work: () => Promise<boolean>) => {
          order.push(`held:${name}`);
          const outcome = await work();
          order.push('released');
          return outcome;
        },
      },
    });
    const contests = inTurn(agedOut, () => ok([]));
    serve((url) => {
      if (url === '/auth/refresh') {
        order.push('renewing');
        return ok({ hostId: 'h1', role: 'host' });
      }
      return contests();
    });

    await expect(listContests()).resolves.toEqual([]);

    // The renewal happens inside the lock, not merely near it.
    expect(order).toEqual(['held:tapas-host-session-renewal', 'renewing', 'released']);
  });

  it('does not renew again when the tab it waited for already did', async () => {
    /*
     * Measured against a real API, and it is why taking turns is not the whole
     * fix. Two tabs queue; both renewals are answered 200; the second rotation
     * revokes the session the first was just given, and the first tab's retry —
     * carrying the access token from its own renewal — is refused.
     *
     * The tab that waited must therefore notice that the wait was the point,
     * and renew nothing.
     */
    localStorage.setItem('tapas-host-session-renewed', 'before');
    vi.stubGlobal('navigator', {
      locks: {
        request: async (_name: string, work: () => Promise<boolean>) => {
          // While this tab queued, the other one renewed and left its mark.
          localStorage.setItem('tapas-host-session-renewed', 'after');
          return work();
        },
      },
    });
    const contests = inTurn(agedOut, () => ok([]));
    serve((url) => (url === '/auth/refresh' ? ok({}) : contests()));

    // The work still gets done — on the cookies the other tab put in the jar.
    await expect(listContests()).resolves.toEqual([]);
    expect(renewalsCalled()).toBe(0);
  });

  it('renews when the mark is unchanged, and leaves a new one for the other tabs', async () => {
    localStorage.setItem('tapas-host-session-renewed', 'unchanged');
    vi.stubGlobal('navigator', {
      locks: { request: (_name: string, work: () => Promise<boolean>) => work() },
    });
    const contests = inTurn(agedOut, () => ok([]));
    serve((url) => (url === '/auth/refresh' ? ok({}) : contests()));

    await expect(listContests()).resolves.toEqual([]);
    expect(renewalsCalled()).toBe(1);
    // Without this the next tab to queue would renew again, which is the whole
    // defect this pair of tests exists for.
    expect(localStorage.getItem('tapas-host-session-renewed')).not.toBe('unchanged');
  });

  it('still renews where the browser offers no such lock', async () => {
    // Nothing here depends on the lock existing: an older browser keeps the
    // per-tab single-flight and the behaviour it had.
    vi.stubGlobal('navigator', {});
    const contests = inTurn(agedOut, () => ok([]));
    serve((url) => (url === '/auth/refresh' ? ok({ hostId: 'h1', role: 'host' }) : contests()));

    await expect(listContests()).resolves.toEqual([]);
    expect(renewalsCalled()).toBe(1);
  });
});
