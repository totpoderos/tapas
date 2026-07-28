import type { FastifyReply } from 'fastify';
import type { Session } from '../auth/token-issuer.js';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS } from '../auth/token-issuer.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const VOTER_COOKIE = 'voter_token';

/** How a session cookie travels: the two attributes that have to move together. */
export interface CookieTransport {
  readonly secure: boolean;
  readonly sameSite: 'none' | 'lax';
}

/**
 * The transport for an environment.
 *
 * Deployed, the two frontends and the API are separate origins (design.md
 * §11B.1), so the cookies must be `SameSite=None` to be sent cross-site at all —
 * which browsers only honour alongside `Secure`. Production also forces
 * HTTP -> HTTPS (`https-redirect.ts`), so `Secure` costs nothing there.
 *
 * In development the app is served over plain HTTP, and **Safari refuses to keep
 * a `Secure` cookie from an insecure origin** — Chrome has an explicit exception
 * for localhost, Safari has none. Marking it `Secure` anyway meant a participant
 * on Safari joined a contest, was shown as joined (the app remembers who they are
 * on the device, separately from the session), and then had every request refused
 * — reported to them as "Your dish couldn't be saved". Development is also
 * same-origin, because the dev server proxies the API under the app's own origin,
 * so `Lax` is both sufficient and correct there.
 *
 * The condition is deliberately "is it development?" and NOT "is it production?".
 * An unset, misspelt or unfamiliar environment must land on the strict setting:
 * the only way to weaken the cookie is to say `development` outright.
 */
export function cookieTransportFor(nodeEnv: string): CookieTransport {
  return nodeEnv === 'development'
    ? { secure: false, sameSite: 'lax' }
    : { secure: true, sameSite: 'none' };
}

export function setSessionCookies(
  reply: FastifyReply,
  session: Session,
  transport: CookieTransport,
): void {
  reply.setCookie(ACCESS_COOKIE, session.accessToken, {
    httpOnly: true,
    ...transport,
    path: '/',
    maxAge: ACCESS_TTL_SECONDS,
  });
  reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    ...transport,
    path: '/',
    maxAge: REFRESH_TTL_SECONDS,
  });
}

export function clearSessionCookies(reply: FastifyReply): void {
  reply.clearCookie(ACCESS_COOKIE, { path: '/' });
  reply.clearCookie(REFRESH_COOKIE, { path: '/' });
}

/** The voter's remember-me token: a single long-lived cookie, no access/refresh split. */
export function setVoterCookie(
  reply: FastifyReply,
  session: Session,
  transport: CookieTransport,
): void {
  reply.setCookie(VOTER_COOKIE, session.refreshToken, {
    httpOnly: true,
    ...transport,
    path: '/',
    maxAge: REFRESH_TTL_SECONDS,
  });
}
