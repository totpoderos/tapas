import type { FastifyReply, FastifyRequest } from 'fastify';
import type { HostPatRepository } from '../db/host-pat-repository.js';
import { hashPatToken } from '../auth/pat-hasher.js';
import type { SessionStore } from '../auth/session-store.js';
import type { TokenIssuer } from '../auth/token-issuer.js';
import type { SecurityEventLog } from '../security/security-event.js';
import { ACCESS_COOKIE } from './session-cookies.js';

export interface HostSession {
  readonly id: string;
  /**
   * How this request proved who it is. Administrative work requires
   * `'session'`: a personal access token carries the powers of a host and
   * never those of an administrator, so a leaked token can never reach the
   * administrative surface (openspec/specs/administrative-access).
   *
   * The caller's role is deliberately absent. Role is read from the account
   * store at the point of the check, never from the token — refreshing a
   * session carries the previous token's role claim forward rather than
   * re-reading the account, so a role taken from a claim would survive a
   * demotion forever.
   */
  readonly authenticatedBy: 'session' | 'personal-access-token';
}

declare module 'fastify' {
  interface FastifyRequest {
    hostSession?: HostSession;
  }
}

export interface RequireHostSessionDeps {
  readonly tokens: TokenIssuer;
  readonly sessions: SessionStore;
  readonly pats: HostPatRepository;
  readonly securityLog: SecurityEventLog;
}

const notSignedIn = { error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' } };
const BEARER_PREFIX = 'Bearer ';

/**
 * Fastify preHandler: lets the request through with either a live, non-revoked
 * access session cookie, or an `Authorization: Bearer <personal-access-token>`
 * header — both resolve to the same host identity, and to the same ownership
 * checks downstream (design.md §11B: the in-app session and an external MCP
 * client are indistinguishable for a host's own work).
 *
 * They are NOT indistinguishable for administrative work: the two branches
 * differ in `authenticatedBy`, and `requireAdministrator` refuses anything that
 * did not arrive on a cookie session.
 */
export function requireHostSession(deps: RequireHostSessionDeps) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const bearer = request.headers.authorization;
    if (bearer?.startsWith(BEARER_PREFIX)) {
      const pat = await deps.pats.findByTokenHash(hashPatToken(bearer.slice(BEARER_PREFIX.length)));
      if (pat && !pat.revokedAt) {
        request.hostSession = { id: pat.hostId, authenticatedBy: 'personal-access-token' };
        await deps.securityLog.record({ type: 'pat.used', actorId: pat.hostId, sourceIp: request.ip });
        return;
      }
      await reply.code(401).send(notSignedIn);
      return;
    }

    const token = request.cookies[ACCESS_COOKIE];
    const claims = token ? deps.tokens.verify(token) : null;
    if (!claims || claims.typ !== 'access' || !await deps.sessions.isActive(claims.jti)) {
      await reply.code(401).send(notSignedIn);
      return;
    }
    request.hostSession = { id: claims.sub, authenticatedBy: 'session' };
  };
}
