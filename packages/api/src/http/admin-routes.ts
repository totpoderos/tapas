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
 * What an administrator is told about an invitation they just issued. The link
 * appears only when no mail server would take the message, and only here — it
 * is never stored, so this answer is the one chance to copy it.
 */
function invitationAnswer(issued: {
  invitationId: string;
  messageSent: boolean;
  link?: string;
}): Record<string, unknown> {
  return issued.messageSent
    ? { invitationId: issued.invitationId, messageSent: true }
    : { invitationId: issued.invitationId, messageSent: false, link: issued.link };
}

/** Mail failing quietly is how an enrollment path stops working with nobody told. */
async function recordUnsentMessage(deps: ServerDeps, actorId: string | null, sourceIp: string): Promise<void> {
  await deps.securityLog.record({ type: 'invitation.not_sent', actorId, sourceIp });
}

/** An administrator is trusted with the invitations, so these say plainly what went wrong. */
const INVITATION_ACTION_STATUS: Record<string, number> = {
  INVITATION_NOT_FOUND: 404,
  NOTHING_TO_REVOKE: 409,
  INVITATION_FINISHED: 409,
  RESEND_FAILED: 409,
};

/**
 * Work reserved to an administrator. Every route here composes both steps:
 * `requireHostSession` answers "not signed in", `requireAdministrator` answers
 * "not allowed", and the refusal is logged by the latter for all of them.
 */
export function registerAdminRoutes(app: FastifyInstance, deps: ServerDeps): void {
  const preHandler = [requireHostSession(deps), requireAdministrator(deps)];

  app.get('/admin/hosts', { preHandler }, async (_request, reply) => {
    return reply.code(200).send({ hosts: await deps.listHostAccounts.execute() });
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
      await deps.securityLog.record({
        type: 'invitation.issued',
        actorId: invitedBy,
        sourceIp: request.ip,
      });
      if (!invited.messageSent) await recordUnsentMessage(deps, invitedBy, request.ip);
      return reply.code(201).send(invitationAnswer(invited));
    },
  );

  app.get('/admin/invites', { preHandler }, async (_request, reply) => {
    return reply.code(200).send({ invitations: await deps.listInvitations.execute() });
  });

  app.post<{ Params: { id: string } }>(
    '/admin/invites/:id/revoke',
    { preHandler },
    async (request, reply) => {
      const revoked = await deps.revokeInvitation.execute(request.params.id);
      if (!revoked.ok)
        return reply
          .code(INVITATION_ACTION_STATUS[revoked.error.code] ?? 400)
          .send({ error: revoked.error });

      await deps.securityLog.record({
        type: 'invitation.revoked',
        actorId: request.hostSession!.id,
        sourceIp: request.ip,
      });
      return reply.code(200).send({});
    },
  );

  app.post<{ Params: { id: string } }>(
    '/admin/invites/:id/resend',
    { preHandler },
    async (request, reply) => {
      const resentBy = request.hostSession!.id;
      const resent = await deps.resendInvitation.execute(request.params.id, resentBy);
      if (!resent.ok)
        return reply
          .code(INVITATION_ACTION_STATUS[resent.error.code] ?? 400)
          .send({ error: resent.error });

      // Records the resend; the invitation it issued records itself as issued.
      await deps.securityLog.record({
        type: 'invitation.resent',
        actorId: resentBy,
        sourceIp: request.ip,
      });
      if (!resent.messageSent) await recordUnsentMessage(deps, resentBy, request.ip);
      return reply.code(201).send(invitationAnswer(resent));
    },
  );
}
