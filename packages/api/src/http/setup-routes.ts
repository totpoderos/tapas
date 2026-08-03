import type { FastifyInstance } from 'fastify';
import type { ClaimDeploymentErrorCode } from '../auth/use-cases/claim-deployment.js';
import { SENSITIVE_RATE_LIMIT } from './rate-limit.js';
import type { ServerDeps } from './server-deps.js';

const CLAIM_ERROR_STATUS: Record<ClaimDeploymentErrorCode, number> = {
  SETUP_COMPLETE: 409,
  CLAIM_REFUSED: 403,
};

/**
 * How a deployment with no administrator gets one. Both routes are anonymous —
 * there is nobody to authenticate as yet — so both carry the sensitive rate
 * limit.
 *
 * That the read route reveals whether a deployment is unclaimed is deliberate:
 * the first-run screen must know whether to offer itself, an attempt to claim
 * would reveal the same, and knowing costs a stranger nothing while they cannot
 * pass the address gate.
 */
export function registerSetupRoutes(app: FastifyInstance, deps: ServerDeps): void {
  app.get('/setup/admin', { config: { rateLimit: SENSITIVE_RATE_LIMIT } }, async (_request, reply) => {
    return reply.code(200).send({ unclaimed: await deps.claimDeployment.isUnclaimed() });
  });

  app.post<{ Body: { email: string } }>(
    '/setup/admin',
    { config: { rateLimit: SENSITIVE_RATE_LIMIT } },
    async (request, reply) => {
      const claimed = await deps.claimDeployment.execute(request.body.email);

      if (!claimed.ok) {
        // The caller is told nothing useful, so the log is where an attempt to
        // take somebody else's deployment leaves its only trace.
        await deps.securityLog.record({
          type: 'admin_bootstrap.refused',
          actorId: null,
          sourceIp: request.ip,
          reason: claimed.error.code === 'SETUP_COMPLETE' ? 'already_claimed' : 'wrong_address',
        });
        return reply.code(CLAIM_ERROR_STATUS[claimed.error.code]).send({ error: claimed.error });
      }

      // Never records which address was configured — only that a claim happened.
      await deps.securityLog.record({
        type: 'admin_bootstrap.claimed',
        actorId: null,
        sourceIp: request.ip,
      });
      if (!claimed.messageSent) {
        await deps.securityLog.record({
          type: 'invitation.not_sent',
          actorId: null,
          sourceIp: request.ip,
        });
      }
      return reply.code(201).send(
        claimed.messageSent
          ? { invitationId: claimed.invitationId, messageSent: true }
          : { invitationId: claimed.invitationId, messageSent: false, link: claimed.link },
      );
    },
  );
}
