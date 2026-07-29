import type { FastifyInstance } from 'fastify';
import type { AcceptInvitationResult } from '../auth/use-cases/accept-invitation.js';
import { SENSITIVE_RATE_LIMIT } from './rate-limit.js';
import type { ServerDeps } from './server-deps.js';

const ACCEPT_ERROR_STATUS: Record<string, number> = {
  INVITATION_UNUSABLE: 404,
  INVALID_EMAIL: 400,
  WEAK_PASSWORD: 400,
  EMAIL_TAKEN: 409,
};

/**
 * The two routes an invited person uses. Both are anonymous and both take a
 * token from the URL, so both carry the sensitive rate limit — the read route
 * especially, since it is the one an attacker would use to hunt for a valid
 * token.
 */
export function registerInvitationRoutes(app: FastifyInstance, deps: ServerDeps): void {
  app.get<{ Params: { token: string } }>(
    '/invites/:token',
    { config: { rateLimit: SENSITIVE_RATE_LIMIT } },
    async (request, reply) => {
      const opened = deps.openInvitation.execute(request.params.token);
      if (!opened.ok) return reply.code(404).send({ error: opened.error });
      return reply.code(200).send({ email: opened.email });
    },
  );

  app.post<{ Params: { token: string }; Body: { password: string } }>(
    '/invites/:token/accept',
    { config: { rateLimit: SENSITIVE_RATE_LIMIT } },
    async (request, reply) => {
      const accepted: AcceptInvitationResult = await deps.acceptInvitation.execute(
        request.params.token,
        request.body.password,
      );

      if (!accepted.ok) {
        if (accepted.error.code === 'INVITATION_UNUSABLE') {
          // The caller is told nothing, so the log is the only place someone
          // guessing at links can be seen.
          deps.securityLog.record({
            type: 'invitation.refused',
            actorId: null,
            sourceIp: request.ip,
          });
        }
        return reply.code(ACCEPT_ERROR_STATUS[accepted.error.code] ?? 400).send({
          error: accepted.error,
        });
      }

      deps.securityLog.record({
        type: 'invitation.accepted',
        actorId: accepted.hostId,
        sourceIp: request.ip,
      });
      // No session: the caller signs in afterwards through the one path that
      // issues cookies, so every session still has a sign-in behind it.
      return reply.code(201).send({ hostId: accepted.hostId });
    },
  );
}
