import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SessionStore } from '../auth/session-store.js';
import type { TokenIssuer } from '../auth/token-issuer.js';
import { ACCESS_COOKIE } from './session-cookies.js';

export interface HostSession {
  readonly id: string;
  readonly role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    hostSession?: HostSession;
  }
}

export interface RequireHostSessionDeps {
  readonly tokens: TokenIssuer;
  readonly sessions: SessionStore;
}

const notSignedIn = { error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' } };

/** Fastify preHandler: only lets the request through with a live, non-revoked access session. */
export function requireHostSession(deps: RequireHostSessionDeps) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const token = request.cookies[ACCESS_COOKIE];
    const claims = token ? deps.tokens.verify(token) : null;
    if (!claims || claims.typ !== 'access' || !deps.sessions.isActive(claims.jti)) {
      await reply.code(401).send(notSignedIn);
      return;
    }
    request.hostSession = { id: claims.sub, role: claims.role };
  };
}
