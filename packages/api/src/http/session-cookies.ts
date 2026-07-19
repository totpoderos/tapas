import type { FastifyReply } from 'fastify';
import type { Session } from '../auth/token-issuer.js';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS } from '../auth/token-issuer.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

export interface CookieOptions {
  readonly secure: boolean;
}

export function setSessionCookies(reply: FastifyReply, session: Session, options: CookieOptions): void {
  reply.setCookie(ACCESS_COOKIE, session.accessToken, {
    httpOnly: true,
    secure: options.secure,
    sameSite: 'strict',
    path: '/',
    maxAge: ACCESS_TTL_SECONDS,
  });
  reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    secure: options.secure,
    sameSite: 'strict',
    path: '/',
    maxAge: REFRESH_TTL_SECONDS,
  });
}

export function clearSessionCookies(reply: FastifyReply): void {
  reply.clearCookie(ACCESS_COOKIE, { path: '/' });
  reply.clearCookie(REFRESH_COOKIE, { path: '/' });
}
