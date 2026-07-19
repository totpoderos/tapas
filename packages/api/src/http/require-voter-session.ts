import type { FastifyReply, FastifyRequest } from 'fastify';
import type { TokenIssuer } from '../auth/token-issuer.js';
import { VOTER_COOKIE } from './session-cookies.js';

export interface VoterSession {
  readonly id: string;
  readonly contestId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    voterSession?: VoterSession;
  }
}

export interface RequireVoterSessionDeps {
  readonly tokens: TokenIssuer;
}

const notSignedIn = { error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' } };
const notAllowed = {
  error: { code: 'NOT_ALLOWED', message: 'That token is not for this contest.' },
};

/**
 * Fastify preHandler: only lets the request through with a voter token scoped
 * to the `:contestId` route param — a voter's token for one contest carries
 * no weight for another (401 no token / invalid, 403 wrong contest).
 */
export function requireVoterSession(deps: RequireVoterSessionDeps) {
  return async (
    request: FastifyRequest<{ Params: { contestId: string } }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const token = request.cookies[VOTER_COOKIE];
    const claims = token ? deps.tokens.verify(token) : null;
    if (!claims || claims.role !== 'voter') {
      await reply.code(401).send(notSignedIn);
      return;
    }
    if (claims.contestId !== request.params.contestId) {
      await reply.code(403).send(notAllowed);
      return;
    }
    request.voterSession = { id: claims.sub, contestId: claims.contestId };
  };
}
