import type { FastifyReply } from 'fastify';
import type { Session } from '../auth/token-issuer.js';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS } from '../auth/token-issuer.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const VOTER_COOKIE = 'voter_token';

/**
 * The two frontends and the API are separate origins (design.md §11B.1), so
 * session cookies must be `SameSite=None` to be sent cross-site at all — which
 * browsers only honour alongside `Secure`, so that is not optional here.
 */
export function setSessionCookies(reply: FastifyReply, session: Session): void {
  reply.setCookie(ACCESS_COOKIE, session.accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: ACCESS_TTL_SECONDS,
  });
  reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: REFRESH_TTL_SECONDS,
  });
}

export function clearSessionCookies(reply: FastifyReply): void {
  reply.clearCookie(ACCESS_COOKIE, { path: '/' });
  reply.clearCookie(REFRESH_COOKIE, { path: '/' });
}

/** The voter's remember-me token: a single long-lived cookie, no access/refresh split. */
export function setVoterCookie(reply: FastifyReply, session: Session): void {
  reply.setCookie(VOTER_COOKIE, session.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: REFRESH_TTL_SECONDS,
  });
}
