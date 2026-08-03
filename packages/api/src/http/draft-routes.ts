import { stillNeeded, type ContestFormat, type DraftContent, type ScoreRange } from '@tapas/domain';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { StoredDraft } from '../drafts/stored-draft.js';
import type { DraftFailureCode } from '../drafts/use-cases/shared.js';
import type { ScoringChangeResult } from '../drafts/use-cases/shape-draft-scoring.js';
import type { PeopleChangeResult } from '../drafts/use-cases/settle-draft-people.js';
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

/**
 * A draft, answered with what it still has to say before it can be published.
 *
 * Every route that answers with a draft answers this way, so a draft read by its
 * name and the same draft read by its id say the same thing about themselves —
 * one of them staying quiet is the asymmetry this repo keeps finding.
 *
 * Absent rather than empty when there is nothing left, following `pairs`: a
 * reader that has to tell "needs nothing" from "was not asked" is a reader that
 * will one day draw an empty warning on a finished contest.
 */
function draftAnswer(draft: StoredDraft): StoredDraft | (StoredDraft & { stillNeeded: readonly string[] }) {
  const needed = stillNeeded(draft.content);
  return needed.length > 0 ? { ...draft, stillNeeded: needed } : draft;
}

const notSignedIn = { error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' } };
const notAllowed = { error: { code: 'NOT_ALLOWED', message: 'Not allowed.' } };
const draftNotFound = { error: { code: 'DRAFT_NOT_FOUND', message: 'No such draft.' } };

export function registerDraftRoutes(app: FastifyInstance, deps: ServerDeps): void {
  const requireSession = requireHostSession(deps);

  /** Loads a draft only if it belongs to the signed-in host, else sends 404/403 and returns null. */
  async function loadOwnedDraft(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<StoredDraft | null> {
    const hostId = request.hostSession?.id;
    if (!hostId) {
      reply.code(401).send(notSignedIn);
      return null;
    }
    const draft = await deps.drafts.findById(request.params.id);
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

      const created = await deps.createDraft.execute(
        request.hostSession.id,
        request.body,
        provenanceOfRequest(request),
      );
      if (!created.ok)
        return reply.code(DRAFT_ERROR_STATUS[created.error.code]).send({ error: created.error });
      return reply.code(201).send(draftAnswer(created.draft));
    },
  );

  app.get('/drafts', { preHandler: requireSession }, async (request, reply) => {
    if (!request.hostSession) return reply.code(401).send(notSignedIn);
    return reply.code(200).send(await deps.listHostDrafts.execute(request.hostSession.id));
  });

  // Managing a draft's participants by name (drafts only — a published contest's
  // roster is settled at publish). Static paths, so matched ahead of /drafts/:id.
  app.post<{ Body: { contest: string; participant: string } }>(
    '/drafts/participants',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);
      const { contest, participant } = request.body;
      return reply.code(200).send(await deps.addDraftParticipant.execute(request.hostSession.id, contest, participant));
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
      const answer = await deps.removeDraftParticipant.execute(request.hostSession.id, contest, participant);
      // Understood and refused for a reason the host can act on — a name that
      // reaches nobody, or two people at once. The same 422 the scoring and
      // partner refusals use, so one kind of answer has one kind of status.
      if (!answer.ok) return reply.code(422).send({ error: answer.error });
      return reply.code(200).send(answer.result);
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
  async function namedDraft(request: FastifyRequest, reply: FastifyReply, name: string): Promise<string | undefined> {
    if (!request.hostSession) {
      void reply.code(401).send(notSignedIn);
      return undefined;
    }
    const resolved = await deps.resolveContestByName.execute(request.hostSession.id, name, { only: 'draft' });
    if (resolved.kind === 'one') return resolved.contest.id;
    void reply.code(200).send({ candidates: resolved.kind === 'several' ? resolved.candidates : [] });
    return undefined;
  }

  app.patch<{ Body: { contest?: string; name?: string } }>(
    '/drafts/by-name',
    { preHandler: requireSession },
    async (request, reply) => {
      const id = await namedDraft(request, reply, request.body?.contest ?? '');
      if (id === undefined) return;
      const renamed = await deps.renameDraft.execute(
        id,
        request.hostSession!.id,
        request.body?.name ?? '',
        provenanceOfRequest(request),
      );
      if (!renamed.ok)
        return reply.code(DRAFT_ERROR_STATUS[renamed.error.code]).send({ error: renamed.error });
      return reply.code(200).send(draftAnswer(renamed.draft));
    },
  );

  app.post<{ Body: { contest?: string } }>(
    '/drafts/by-name/publish',
    { preHandler: requireSession },
    async (request, reply) => {
      const id = await namedDraft(request, reply, request.body?.contest ?? '');
      if (id === undefined) return;
      const published = await deps.publishContest.execute(id, request.hostSession!.id);
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
      const id = await namedDraft(request, reply, request.query.name ?? '');
      if (id === undefined) return;
      const draft = await deps.drafts.findById(id);
      if (!draft) return reply.code(200).send({ candidates: [] });
      return reply.code(200).send(draftAnswer(draft));
    },
  );

  /*
   * Settling a draft's scoring, one thing at a time. Each is its own route
   * because each is its own asking — a host changes what a contest is judged on
   * without restating how it is scored, and a route that took the lot would
   * make a model that omitted a field erase it.
   *
   * All addressed by the contest's name, draft-only, through the shared
   * resolver — so a shared name answers with candidates here exactly as it does
   * everywhere else.
   */
  function peopleAnswer(reply: FastifyReply, answer: PeopleChangeResult) {
    // Understood and refused for a reason the host can act on — a name that
    // addresses nobody, or two people at once — rather than malformed.
    if (!answer.ok) return reply.code(422).send({ error: answer.error });
    return reply.code(200).send(answer.result);
  }

  function scoringAnswer(reply: FastifyReply, answer: ScoringChangeResult) {
    if (!answer.ok) {
      // The change was understood and refused for a reason the host can act on:
      // unprocessable, not malformed.
      return reply.code(422).send({ error: answer.error });
    }
    return reply.code(200).send(answer.result);
  }

  app.post<{ Body: { contest?: string; category?: string } }>(
    '/drafts/by-name/categories',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);
      const answer = await deps.addScoringCategory.execute(
        request.hostSession.id,
        request.body?.contest ?? '',
        request.body?.category ?? '',
      );
      return scoringAnswer(reply, answer);
    },
  );

  // Removing is destructive (the assistant confirms with the host first); the
  // params ride the query so a body isn't needed on DELETE.
  app.delete<{ Querystring: { contest?: string; category?: string } }>(
    '/drafts/by-name/categories',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);
      const answer = await deps.removeScoringCategory.execute(
        request.hostSession.id,
        request.query.contest ?? '',
        request.query.category ?? '',
      );
      return scoringAnswer(reply, answer);
    },
  );

  app.put<{ Body: { contest?: string; min?: number; max?: number } }>(
    '/drafts/by-name/score-range',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);
      const { min, max } = request.body ?? {};
      /*
       * Both bounds or neither. Neither means "work it out from the contest",
       * which is a real choice a host makes — and one bound alone is not half a
       * range, it is a request that cannot be honoured either way.
       */
      const range: ScoreRange =
        typeof min === 'number' && typeof max === 'number' ? { type: 'fixed', min, max } : { type: 'auto' };
      const answer = await deps.setScoreRange.execute(request.hostSession.id, request.body?.contest ?? '', range);
      return scoringAnswer(reply, answer);
    },
  );

  app.put<{ Body: { contest?: string; uniquePerCategory?: boolean } }>(
    '/drafts/by-name/score-uniqueness',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);
      const answer = await deps.setScoreUniqueness.execute(
        request.hostSession.id,
        request.body?.contest ?? '',
        request.body?.uniquePerCategory === true,
      );
      return scoringAnswer(reply, answer);
    },
  );

  /*
   * What kind of contest it is, and who is paired with whom. Same shape as the
   * scoring routes above: draft-only, addressed by the contest's name, one
   * asking changing one thing.
   */
  app.put<{ Body: { contest?: string; format?: ContestFormat } }>(
    '/drafts/by-name/format',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);
      const answer = await deps.setDraftFormat.execute(
        request.hostSession.id,
        request.body?.contest ?? '',
        request.body?.format as ContestFormat,
      );
      return peopleAnswer(reply, answer);
    },
  );

  app.put<{ Body: { contest?: string; person?: string; partner?: string | null } }>(
    '/drafts/by-name/partner',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);
      /*
       * A missing or empty `partner` means "leave this person without one" —
       * which is a real thing a host asks for, distinct from naming somebody.
       */
      const named = request.body?.partner;
      const partner = typeof named === 'string' && named.trim() !== '' ? named : null;
      const answer = await deps.setDraftPartner.execute(
        request.hostSession.id,
        request.body?.contest ?? '',
        request.body?.person ?? '',
        partner,
      );
      return peopleAnswer(reply, answer);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/drafts/:id',
    { preHandler: requireSession },
    async (request, reply) => {
      const draft = await loadOwnedDraft(request, reply);
      if (!draft) return reply;
      return reply.code(200).send(draftAnswer(draft));
    },
  );

  app.patch<{ Params: { id: string }; Body: { name: string } }>(
    '/drafts/:id',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!await loadOwnedDraft(request, reply)) return reply;
      const renamed = await deps.renameDraft.execute(
        request.params.id,
        request.hostSession!.id,
        request.body.name,
        provenanceOfRequest(request),
      );
      if (!renamed.ok)
        return reply.code(DRAFT_ERROR_STATUS[renamed.error.code]).send({ error: renamed.error });
      return reply.code(200).send(draftAnswer(renamed.draft));
    },
  );

  // Real editing: replace the whole draft content (rules, participants, pairings),
  // not just the name. PATCH stays rename-only; PUT is the full-content replace.
  app.put<{ Params: { id: string }; Body: DraftContent }>(
    '/drafts/:id',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!await loadOwnedDraft(request, reply)) return reply;
      const updated = await deps.updateDraft.execute(
        request.params.id,
        request.hostSession!.id,
        request.body,
        provenanceOfRequest(request),
      );
      if (!updated.ok)
        return reply.code(DRAFT_ERROR_STATUS[updated.error.code]).send({ error: updated.error });
      return reply.code(200).send(draftAnswer(updated.draft));
    },
  );

  // `DELETE /drafts/:id` was retired into `DELETE /contests/:id`, which resolves
  // a draft or a published contest by the same id. One host intent, one route,
  // one ownership check — see DeleteContest.

  app.post<{ Params: { id: string } }>(
    '/drafts/:id/publish',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!await loadOwnedDraft(request, reply)) return reply;
      const published = await deps.publishContest.execute(request.params.id, request.hostSession!.id);
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
