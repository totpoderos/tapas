import type { FastifyReply, FastifyRequest } from 'fastify';
import type { HostAccountRepository } from '../db/host-account-repository.js';
import type { SecurityEventLog } from '../security/security-event.js';

export interface RequireAdministratorDeps {
  readonly hostAccounts: HostAccountRepository;
  readonly securityLog: SecurityEventLog;
}

const notSignedIn = { error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' } };
const notAllowed = { error: { code: 'NOT_ALLOWED', message: 'Not allowed.' } };

/**
 * Fastify preHandler reserving work to an administrator. Composes *after*
 * `requireHostSession`, which owns "not signed in" — so in practice this step
 * only ever answers "not allowed", and the two refusals stay distinct (401 vs
 * 403, OWASP A01).
 *
 * Two facts must both hold: the account is an administrator, and the request
 * arrived on a cookie session rather than a personal access token. The role
 * comes from the account store rather than the session, because refreshing a
 * session copies the previous token's role claim forward instead of re-reading
 * the account — a demoted administrator would otherwise keep administrative
 * access for as long as they kept refreshing.
 *
 * The refusal is recorded here rather than by each route, so every
 * administrative route added later inherits its privilege-escalation logging
 * and none can forget it.
 */
export function requireAdministrator(deps: RequireAdministratorDeps) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const session = request.hostSession;
    if (!session) {
      await reply.code(401).send(notSignedIn);
      return;
    }

    const account =
      session.authenticatedBy === 'session' ? deps.hostAccounts.findById(session.id) : undefined;
    if (account?.role !== 'admin') {
      deps.securityLog.record({
        type: 'admin_access.refused',
        actorId: session.id,
        sourceIp: request.ip,
      });
      await reply.code(403).send(notAllowed);
    }
  };
}
