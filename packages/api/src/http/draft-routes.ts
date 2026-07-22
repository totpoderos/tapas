import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { StoredDraft } from '../drafts/stored-draft.js';
import type { DraftFailureCode } from '../drafts/use-cases/shared.js';
import type { PublishFailureCode } from '../contests/use-cases/shared.js';
import { MergeContestDraftInputSchema } from '../drafts/extraction/merge-contest-draft.js';
import { requireHostSession } from './require-host-session.js';
import type { ServerDeps } from './server-deps.js';

const DRAFT_ERROR_STATUS: Record<DraftFailureCode, number> = {
  NAME_REQUIRED: 400,
  DRAFT_NOT_FOUND: 404,
};

// A draft that can't be published is understood but unprocessable (422); a
// missing one is a 404. (Cross-host is caught earlier at the route as a 403.)
function publishErrorStatus(code: PublishFailureCode): number {
  return code === 'DRAFT_NOT_FOUND' ? 404 : 422;
}

const notSignedIn = { error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' } };
const notAllowed = { error: { code: 'NOT_ALLOWED', message: 'Not allowed.' } };
const draftNotFound = { error: { code: 'DRAFT_NOT_FOUND', message: 'No such draft.' } };

export function registerDraftRoutes(app: FastifyInstance, deps: ServerDeps): void {
  const requireSession = requireHostSession(deps);

  /** Loads a draft only if it belongs to the signed-in host, else sends 404/403 and returns null. */
  function loadOwnedDraft(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): StoredDraft | null {
    const hostId = request.hostSession?.id;
    if (!hostId) {
      reply.code(401).send(notSignedIn);
      return null;
    }
    const draft = deps.drafts.findById(request.params.id);
    if (!draft) {
      reply.code(404).send(draftNotFound);
      return null;
    }
    if (draft.hostId !== hostId) {
      reply.code(403).send(notAllowed);
      return null;
    }
    return draft;
  }

  app.post<{ Body: DraftContent }>(
    '/drafts',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);

      const created = deps.createDraft.execute(request.hostSession.id, request.body);
      if (!created.ok)
        return reply.code(DRAFT_ERROR_STATUS[created.error.code]).send({ error: created.error });
      return reply.code(201).send(created.draft);
    },
  );

  app.get('/drafts', { preHandler: requireSession }, async (request, reply) => {
    if (!request.hostSession) return reply.code(401).send(notSignedIn);
    return reply.code(200).send(deps.listHostDrafts.execute(request.hostSession.id));
  });

  app.get<{ Params: { id: string } }>(
    '/drafts/:id',
    { preHandler: requireSession },
    async (request, reply) => {
      const draft = loadOwnedDraft(request, reply);
      if (!draft) return reply;
      return reply.code(200).send(draft);
    },
  );

  app.patch<{ Params: { id: string }; Body: { name: string } }>(
    '/drafts/:id',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!loadOwnedDraft(request, reply)) return reply;
      const renamed = deps.renameDraft.execute(
        request.params.id,
        request.hostSession!.id,
        request.body.name,
      );
      if (!renamed.ok)
        return reply.code(DRAFT_ERROR_STATUS[renamed.error.code]).send({ error: renamed.error });
      return reply.code(200).send(renamed.draft);
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/drafts/:id',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!loadOwnedDraft(request, reply)) return reply;
      const discarded = deps.discardDraft.execute(request.params.id, request.hostSession!.id);
      if (!discarded.ok)
        return reply
          .code(DRAFT_ERROR_STATUS[discarded.error.code])
          .send({ error: discarded.error });
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    '/drafts/:id/publish',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!loadOwnedDraft(request, reply)) return reply;
      const published = deps.publishContest.execute(request.params.id, request.hostSession!.id);
      if (!published.ok)
        return reply
          .code(publishErrorStatus(published.error.code))
          .send({ error: published.error });
      const { id, name, joinCode } = published.contest;
      return reply.code(201).send({ id, name, joinCode });
    },
  );

  app.post<{ Body: { message?: string } }>(
    '/drafts/extract',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);

      const message = request.body?.message?.trim();
      if (!message) {
        return reply
          .code(400)
          .send({ error: { code: 'MESSAGE_REQUIRED', message: 'A message is required.' } });
      }

      const extracted = await deps.extractContestDraft.execute(message);
      return reply.code(200).send(extracted);
    },
  );

  app.post<{ Body: unknown }>(
    '/drafts/merge',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);

      // The prior draft round-trips through the client, so the whole body is
      // untrusted: validate it before it reaches the assistant (design.md §11B.3).
      const input = MergeContestDraftInputSchema.safeParse(request.body);
      if (!input.success) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_MERGE_REQUEST',
            message: 'A prior draft, its clarifications, and a reply are required.',
          },
        });
      }

      const merged = await deps.mergeContestDraft.execute(input.data);
      return reply.code(200).send(merged);
    },
  );
}
