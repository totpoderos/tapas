import type { FastifyInstance } from 'fastify';
import type { InviteHostErrorCode } from '../auth/use-cases/invite-host.js';
import { requireAdministrator } from './require-administrator.js';
import { requireHostSession } from './require-host-session.js';
import type { ServerDeps } from './server-deps.js';

const INVITE_ERROR_STATUS: Record<InviteHostErrorCode, number> = {
  INVALID_EMAIL: 400,
  EMAIL_TAKEN: 409,
};

/**
 * Work reserved to an administrator. Every route here composes both steps:
 * `requireHostSession` answers "not signed in", `requireAdministrator` answers
 * "not allowed", and the refusal is logged by the latter for all of them.
 */
export function registerAdminRoutes(app: FastifyInstance, deps: ServerDeps): void {
  const preHandler = [requireHostSession(deps), requireAdministrator(deps)];

  app.get('/admin/hosts', { preHandler }, async (_request, reply) => {
    return reply.code(200).send({ hosts: deps.listHostAccounts.execute() });
  });

  app.post<{ Body: { email: string } }>(
    '/admin/invites',
    { preHandler },
    async (request, reply) => {
      const invitedBy = request.hostSession!.id;
      const invited = await deps.inviteHost.execute(request.body.email, invitedBy);
      if (!invited.ok)
        return reply.code(INVITE_ERROR_STATUS[invited.error.code]).send({ error: invited.error });

      // Records that an invitation was issued — never the token it carries.
      deps.securityLog.record({
        type: 'invitation.issued',
        actorId: invitedBy,
        sourceIp: request.ip,
      });
      return reply.code(201).send({ invitationId: invited.invitationId });
    },
  );
}
