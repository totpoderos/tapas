import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describe, expect, it } from 'vitest';
import type { DraftContent } from '@tapas/domain';
import { makeTestApp } from '../../support/test-server.js';
import type { Env } from '../../../src/index.js';

const STRONG_PASSWORD = 'Str0ng!Passw0rd';

/**
 * The defect this guards against: the session cookies were marked `Secure`
 * unconditionally. Safari refuses to keep a `Secure` cookie served over plain
 * HTTP — Chrome makes an exception for localhost, Safari makes none — so in
 * development a participant joined, was shown as joined (the app remembers that
 * on the device, separately from the session), and then every request that
 * needed the session was refused. It surfaced as "Your dish couldn't be saved".
 *
 * These assert the attributes the browser actually receives, per environment,
 * rather than a helper in isolation — the browser only ever sees the header.
 */

function content(): DraftContent {
  return {
    name: 'Summer Tapas',
    attribution: 'per_person',
    antiBias: 'none',
    scoring: {
      categories: [{ id: 'taste', name: 'Taste' }],
      range: { type: 'fixed', min: 1, max: 5 },
      uniquePerCategory: false,
    },
    // Two, because a lone participant can score nothing and publish refuses it
    // (JUDGE_CANNOT_SCORE_ANY_DISH).
    participants: [
      { id: 'ana', displayName: 'Ana' },
      { id: 'bob', displayName: 'Bob' },
    ],
  };
}

interface SetCookie {
  name: string;
  secure?: boolean;
  sameSite?: string;
  httpOnly?: boolean;
}

const cookie = (response: LightMyRequestResponse, name: string): SetCookie => {
  const found = (response.cookies as unknown as SetCookie[]).find((c) => c.name === name);
  if (!found) throw new Error(`no ${name} cookie was set`);
  return found;
};

/**
 * In production the app forces HTTP -> HTTPS (`https-redirect.ts`), so a plain
 * request is answered 301 and never reaches a handler that sets a cookie. The
 * app is built with `trustProxy`, so presenting as HTTPS is what a real request
 * behind the reverse proxy looks like — which is also why `Secure` is always
 * right in production.
 */
const asHttps = { 'x-forwarded-proto': 'https' };

/** Signs a host in, returning the response that carries their session cookies. */
async function login(app: FastifyInstance): Promise<LightMyRequestResponse> {
  const payload = { email: 'h@x.es', password: STRONG_PASSWORD };
  await app.inject({ method: 'POST', url: '/auth/register', payload, headers: asHttps });
  return app.inject({ method: 'POST', url: '/auth/login', payload, headers: asHttps });
}

/** Publishes a contest and claims a place, returning the response that carries the voter cookie. */
async function claim(app: FastifyInstance): Promise<LightMyRequestResponse> {
  const signedIn = await login(app);
  const jar = signedIn.cookies
    .map((c) => `${(c as unknown as { name: string }).name}=${(c as unknown as { value: string }).value}`)
    .join('; ');
  const created = await app.inject({
    method: 'POST',
    url: '/drafts',
    payload: content(),
    headers: { cookie: jar, ...asHttps },
  });
  expect(created.statusCode).toBe(201);
  const published = await app.inject({
    method: 'POST',
    url: `/drafts/${created.json().id}/publish`,
    headers: { cookie: jar, ...asHttps },
  });
  expect(published.statusCode).toBe(201);
  return app.inject({
    method: 'POST',
    url: `/contests/${published.json().joinCode}/claim`,
    payload: { participantId: 'ana' },
    headers: asHttps,
  });
}

const appFor = (nodeEnv: Env['NODE_ENV']) => makeTestApp(undefined, { NODE_ENV: nodeEnv }).app;

describe('session cookies follow how the site is served', () => {
  describe.each([['production'], ['test']] as const)('in %s', (nodeEnv) => {
    it("restricts the host's session to secure connections, cross-site", async () => {
      const response = await login(appFor(nodeEnv));
      const access = cookie(response, 'access_token');
      expect(access.secure).toBe(true);
      expect(String(access.sameSite).toLowerCase()).toBe('none');
      expect(access.httpOnly).toBe(true);
    });

    it("restricts the voter's session to secure connections, cross-site", async () => {
      const voter = cookie(await claim(appFor(nodeEnv)), 'voter_token');
      expect(voter.secure).toBe(true);
      expect(String(voter.sameSite).toLowerCase()).toBe('none');
      expect(voter.httpOnly).toBe(true);
    });
  });

  describe('in development, where the app is served over plain HTTP', () => {
    // Secure would be dropped by Safari here, taking the session with it. The
    // dev server proxies the API under the app's own origin, so the cookie is
    // first-party and `lax` is both sufficient and correct.
    it("does not restrict the host's session to secure connections", async () => {
      const access = cookie(await login(appFor('development')), 'access_token');
      expect(access.secure).toBeFalsy();
      expect(String(access.sameSite).toLowerCase()).toBe('lax');
      expect(access.httpOnly).toBe(true); // still never readable from JS
    });

    it("does not restrict the voter's session to secure connections", async () => {
      const voter = cookie(await claim(appFor('development')), 'voter_token');
      expect(voter.secure).toBeFalsy();
      expect(String(voter.sameSite).toLowerCase()).toBe('lax');
      expect(voter.httpOnly).toBe(true);
    });
  });

  // The condition must be "is it development?", never "is it production?".
  // An unset, misspelt or unfamiliar environment has to land on the strict
  // setting — the only way to weaken the cookie is to say `development` outright.
  it('stays strict for any environment that is not explicitly development', async () => {
    const unfamiliar = 'staging' as unknown as Env['NODE_ENV'];
    const access = cookie(await login(appFor(unfamiliar)), 'access_token');
    expect(access.secure).toBe(true);
    expect(String(access.sameSite).toLowerCase()).toBe('none');
  });
});
