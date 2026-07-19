import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance } from 'fastify';
import type { DraftFailureCode } from '../drafts/use-cases/shared.js';
import { requireHostSession } from './require-host-session.js';
import type { ServerDeps } from './server-deps.js';

const DRAFT_ERROR_STATUS: Record<DraftFailureCode, number> = {
  NAME_REQUIRED: 400,
  DRAFT_NOT_FOUND: 404,
};

const notSignedIn = { error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' } };
const notAllowed = { error: { code: 'NOT_ALLOWED', message: 'Not allowed.' } };

export function registerDraftRoutes(app: FastifyInstance, deps: ServerDeps): void {
  const requireSession = requireHostSession(deps);

  app.post<{ Body: DraftContent }>('/drafts', { preHandler: requireSession }, async (request, reply) => {
    if (!request.hostSession) return reply.code(401).send(notSignedIn);

    const created = deps.createDraft.execute(request.hostSession.id, request.body);
    if (!created.ok) return reply.code(DRAFT_ERROR_STATUS[created.error.code]).send({ error: created.error });
    return reply.code(201).send(created.draft);
  });

  app.get<{ Params: { id: string } }>('/drafts/:id', { preHandler: requireSession }, async (request, reply) => {
    if (!request.hostSession) return reply.code(401).send(notSignedIn);

    const draft = deps.drafts.findById(request.params.id);
    if (!draft) return reply.code(404).send({ error: { code: 'DRAFT_NOT_FOUND', message: 'No such draft.' } });
    if (draft.hostId !== request.hostSession.id) return reply.code(403).send(notAllowed);
    return reply.code(200).send(draft);
  });
}
