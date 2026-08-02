import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { StoredDraft } from '../drafts/stored-draft.js';
import type { DraftFailureCode } from '../drafts/use-cases/shared.js';
import type { PublishFailureCode } from '../contests/use-cases/shared.js';
import type { ExtractContestDraftResult } from '../drafts/extraction/extract-contest-draft.js';
import {
  MergeContestDraftInputSchema,
  type MergeContestDraftResult,
} from '../drafts/extraction/merge-contest-draft.js';
import { provenanceOfRequest } from './request-provenance.js';
import { requireHostSession } from './require-host-session.js';
import type { ServerDeps } from './server-deps.js';

const DRAFT_ERROR_STATUS: Record<DraftFailureCode, number> = {
  NAME_REQUIRED: 400,
  UNKNOWN_FORMAT: 400,
  DRAFT_NOT_FOUND: 404,
};

// A draft that can't be published is understood but unprocessable (422); a
// missing one is a 404. (Cross-host is caught earlier at the route as a 403.)
function publishErrorStatus(code: PublishFailureCode): number {
  return code === 'DRAFT_NOT_FOUND' ? 404 : 422;
}

/** Strips diagnostics: the assistant endpoints expose the draft and its questions, nothing else. */
function publicDraftResult(result: ExtractContestDraftResult | MergeContestDraftResult) {
  return { draft: result.draft, clarifications: result.clarifications };
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

      const created = deps.createDraft.execute(
        request.hostSession.id,
        request.body,
        provenanceOfRequest(request),
      );
      if (!created.ok)
        return reply.code(DRAFT_ERROR_STATUS[created.error.code]).send({ error: created.error });
      return reply.code(201).send(created.draft);
    },
  );

  app.get('/drafts', { preHandler: requireSession }, async (request, reply) => {
    if (!request.hostSession) return reply.code(401).send(notSignedIn);
    return reply.code(200).send(deps.listHostDrafts.execute(request.hostSession.id));
  });

  // Managing a draft's participants by name (drafts only — a published contest's
  // roster is settled at publish). Static paths, so matched ahead of /drafts/:id.
  app.post<{ Body: { contest: string; participant: string } }>(
    '/drafts/participants',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);
      const { contest, participant } = request.body;
      return reply.code(200).send(deps.addDraftParticipant.execute(request.hostSession.id, contest, participant));
    },
  );

  // Removing is destructive (the assistant confirms with the host first); the
  // params go in the query so a body isn't needed on DELETE.
  app.delete<{ Querystring: { contest?: string; participant?: string } }>(
    '/drafts/participants',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);
      const contest = request.query.contest ?? '';
      const participant = request.query.participant ?? '';
      return reply.code(200).send(deps.removeDraftParticipant.execute(request.hostSession.id, contest, participant));
    },
  );

  /**
   * The id of the draft the host *named*, for the assistant's by-name routes, or
   * `undefined` once the answer has been sent.
   *
   * Same three-way answer as every other by-name route (see `named` in
   * contest-routes.ts): one draft acts, several or none answer 200 with
   * `candidates`. `only: 'draft'` is what makes a published contest of the same
   * name neither a target nor a rival candidate — a host who runs "Tapas Night"
   * every spring must still be able to prepare this year's.
   */
  function namedDraft(request: FastifyRequest, reply: FastifyReply, name: string): string | undefined {
    if (!request.hostSession) {
      void reply.code(401).send(notSignedIn);
      return undefined;
    }
    const resolved = deps.resolveContestByName.execute(request.hostSession.id, name, { only: 'draft' });
    if (resolved.kind === 'one') return resolved.contest.id;
    void reply.code(200).send({ candidates: resolved.kind === 'several' ? resolved.candidates : [] });
    return undefined;
  }

  app.patch<{ Body: { contest?: string; name?: string } }>(
    '/drafts/by-name',
    { preHandler: requireSession },
    async (request, reply) => {
      const id = namedDraft(request, reply, request.body?.contest ?? '');
      if (id === undefined) return;
      const renamed = deps.renameDraft.execute(
        id,
        request.hostSession!.id,
        request.body?.name ?? '',
        provenanceOfRequest(request),
      );
      if (!renamed.ok)
        return reply.code(DRAFT_ERROR_STATUS[renamed.error.code]).send({ error: renamed.error });
      return reply.code(200).send(renamed.draft);
    },
  );

  app.post<{ Body: { contest?: string } }>(
    '/drafts/by-name/publish',
    { preHandler: requireSession },
    async (request, reply) => {
      const id = namedDraft(request, reply, request.body?.contest ?? '');
      if (id === undefined) return;
      const published = deps.publishContest.execute(id, request.hostSession!.id);
      if (!published.ok)
        return reply.code(publishErrorStatus(published.error.code)).send({ error: published.error });
      const { id: contestId, name, joinCode } = published.contest;
      return reply.code(201).send({ id: contestId, name, joinCode });
    },
  );

  app.get<{ Querystring: { name?: string } }>(
    '/drafts/by-name',
    { preHandler: requireSession },
    async (request, reply) => {
      const id = namedDraft(request, reply, request.query.name ?? '');
      if (id === undefined) return;
      const draft = deps.drafts.findById(id);
      if (!draft) return reply.code(200).send({ candidates: [] });
      return reply.code(200).send(draft);
    },
  );

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
        provenanceOfRequest(request),
      );
      if (!renamed.ok)
        return reply.code(DRAFT_ERROR_STATUS[renamed.error.code]).send({ error: renamed.error });
      return reply.code(200).send(renamed.draft);
    },
  );

  // Real editing: replace the whole draft content (rules, participants, pairings),
  // not just the name. PATCH stays rename-only; PUT is the full-content replace.
  app.put<{ Params: { id: string }; Body: DraftContent }>(
    '/drafts/:id',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!loadOwnedDraft(request, reply)) return reply;
      const updated = deps.updateDraft.execute(
        request.params.id,
        request.hostSession!.id,
        request.body,
        provenanceOfRequest(request),
      );
      if (!updated.ok)
        return reply.code(DRAFT_ERROR_STATUS[updated.error.code]).send({ error: updated.error });
      return reply.code(200).send(updated.draft);
    },
  );

  // `DELETE /drafts/:id` was retired into `DELETE /contests/:id`, which resolves
  // a draft or a published contest by the same id. One host intent, one route,
  // one ownership check — see DeleteContest.

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
      // Only the draft and its questions are the host's business — how the
      // model behaved is diagnostics, for logs and the eval harness.
      return reply.code(200).send(publicDraftResult(extracted));
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
      return reply.code(200).send(publicDraftResult(merged));
    },
  );
}
