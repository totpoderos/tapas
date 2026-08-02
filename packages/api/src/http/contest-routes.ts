import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type {
  CloseContestErrorCode,
  DeleteContestErrorCode,
  GetResultsErrorCode,
  GetTallyErrorCode,
  RevealContestErrorCode,
} from '../contests/use-cases/shared.js';
import { auditCsv, auditFilename } from '../audit/audit-csv.js';
import { ensureContestFresh } from '../contests/ensure-fresh.js';
import { toResultsDto } from '../contests/results-dto.js';
import { dishNaming, toRevealDto } from '../contests/reveal-dto.js';
import { toContestDto } from '../contests/contest-dto.js';
import { SENSITIVE_RATE_LIMIT } from './rate-limit.js';
import { provenanceOfRequest } from './request-provenance.js';
import { requireHostSession } from './require-host-session.js';
import type { ServerDeps } from './server-deps.js';

const notSignedIn = { error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' } };
const notAllowed = { error: { code: 'NOT_ALLOWED', message: 'Not allowed.' } };

const CLOSE_CONTEST_ERROR_STATUS: Record<CloseContestErrorCode, number> = {
  CONTEST_NOT_FOUND: 404,
  ALREADY_CLOSED: 409,
};

const REVEAL_CONTEST_ERROR_STATUS: Record<RevealContestErrorCode, number> = {
  CONTEST_NOT_FOUND: 404,
  NOT_CLOSED: 409,
  ALREADY_REVEALED: 409,
};

const GET_RESULTS_ERROR_STATUS: Record<GetResultsErrorCode, number> = {
  CONTEST_NOT_FOUND: 404,
  NOT_REVEALED: 409,
};

const GET_TALLY_ERROR_STATUS: Record<GetTallyErrorCode, number> = {
  CONTEST_NOT_FOUND: 404,
};

const DELETE_CONTEST_ERROR_STATUS: Record<DeleteContestErrorCode, number> = {
  CONTEST_NOT_FOUND: 404,
  NOT_ALLOWED: 403,
  // The contest exists and is theirs, but they have not typed its name. 428:
  // the request is fine, a precondition on the client's side is not met.
  CONFIRMATION_REQUIRED: 428,
};

/**
 * Whether a status change was explicitly confirmed by the host. The in-app
 * assistant sets `x-tapas-confirmation: host` on the request it dispatches after
 * the host accepts the confirmation card; a plain API call carries no such
 * marker and is recorded as `auto`.
 */
function hostConfirmed(request: FastifyRequest): 'host' | 'auto' {
  return request.headers['x-tapas-confirmation'] === 'host' ? 'host' : 'auto';
}

/** Host-scoped contest reads. Voter-scoped contest routes live in voter-routes.ts. */
export function registerContestRoutes(app: FastifyInstance, deps: ServerDeps): void {
  const requireSession = requireHostSession(deps);

  /**
   * The contest at `id`, if the signed-in host owns it. Otherwise the refusal has
   * already been sent and the caller must return at once.
   *
   * Every host contest operation goes through this one gate — including the
   * by-name routes, which reach it having already resolved a name the host owns.
   * Checking twice costs a lookup and means the newer door is not the weaker one.
   */
  function owned(request: FastifyRequest, reply: FastifyReply, id: string) {
    if (!request.hostSession) {
      void reply.code(401).send(notSignedIn);
      return undefined;
    }
    const contest = deps.getContest.execute(id);
    if (!contest) {
      void reply.code(404).send({ error: { code: 'CONTEST_NOT_FOUND', message: 'No such contest.' } });
      return undefined;
    }
    if (contest.hostId !== request.hostSession.id) {
      void reply.code(403).send(notAllowed);
      return undefined;
    }
    return contest;
  }

  /**
   * The id of the contest the host *named*, for the assistant's by-name routes.
   * Otherwise the answer has already been sent and the caller must return.
   *
   * A name several contests bear, and a name none bears, both answer 200 with
   * `candidates` — the shape `/contests/details` already uses, so one client-side
   * reading covers every by-name route. They are told apart by whether the list
   * is empty. Neither is an error: the host has not mistyped a request, they have
   * named something that needs settling first, and nothing has been changed.
   *
   * Only the host's own contests are ever searched, so another host's contest
   * answers "none" rather than 403. A refusal would confirm that a contest by
   * that name exists, which is precisely what a different host must not learn.
   */
  function named(
    request: FastifyRequest<{ Querystring: { name?: string } }> | FastifyRequest<{ Body: { contest?: string } }>,
    reply: FastifyReply,
    name: string,
    options?: { readonly only?: 'draft' },
  ): string | undefined {
    if (!request.hostSession) {
      void reply.code(401).send(notSignedIn);
      return undefined;
    }
    const resolved = deps.resolveContestByName.execute(request.hostSession.id, name, options);
    if (resolved.kind === 'one') return resolved.contest.id;
    void reply.code(200).send({ candidates: resolved.kind === 'several' ? resolved.candidates : [] });
    return undefined;
  }

  /*
   * The log, on screen or as a file. `?format=csv` is the same read behind the
   * same ownership check — deliberately one route, so the rule that decides who
   * may see a contest's history cannot come to differ between looking at it and
   * taking it away.
   */
  app.get<{ Params: { id: string }; Querystring: { format?: string } }>(
    '/contests/:id/audit',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);

      const contest = deps.getContest.execute(request.params.id);
      if (!contest) {
        return reply
          .code(404)
          .send({ error: { code: 'CONTEST_NOT_FOUND', message: 'No such contest.' } });
      }
      if (contest.hostId !== request.hostSession.id) return reply.code(403).send(notAllowed);

      const entries = deps.auditLog.findByContest(request.params.id);
      if (request.query.format !== 'csv') return reply.code(200).send(entries);

      // The filename is reduced to a conservative set by `auditFilename`, so a
      // contest name cannot write a second header field here.
      return reply
        .code(200)
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="${auditFilename(contest.name)}"`)
        .send(auditCsv(entries));
    },
  );

  // The host's contest list. With a `?name=` filter it becomes "find by name"
  // (exact, case-insensitive) so a host can reach a contest the way they say it,
  // not by an internal id; without it, the full list. Both are ownership-scoped.
  /*
   * `?only=draft` narrows the same search the draft-only operations use, so a
   * caller can ask "does this name resolve to one draft?" and get the same
   * answer those operations would act on. The assistant asks exactly this before
   * putting a destructive action to the host: a name that is not yet one contest
   * is not something anybody can meaningfully approve.
   */
  app.get<{ Querystring: { name?: string; only?: string } }>(
    '/contests',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);
      const { name, only } = request.query;
      if (name === undefined) {
        return reply.code(200).send(deps.listMyContests.execute(request.hostSession.id));
      }
      const found = deps.findContestsByName.execute(request.hostSession.id, name);
      return reply.code(200).send(only === 'draft' ? found.filter((c) => c.status === 'draft') : found);
    },
  );

  // What's inside a contest, found by name: participants + scoring categories,
  // reading the same for a draft or a published contest. Ownership-scoped. A
  // static path, so it is matched ahead of `/contests/:id`.
  app.get<{ Querystring: { name?: string } }>(
    '/contests/details',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);
      const name = request.query.name ?? '';
      return reply.code(200).send(deps.getContestDetails.execute(request.hostSession.id, name));
    },
  );

  /*
   * The assistant's doors, all addressed by the name the host said. Static paths,
   * so Fastify matches them ahead of `/contests/:id` — a contest genuinely named
   * "by-name" would otherwise be unreachable by id, which is why these sit here
   * beside `/contests/details` rather than under a name-shaped segment.
   */
  app.get<{ Querystring: { name?: string } }>(
    '/contests/by-name',
    { preHandler: requireSession },
    async (request, reply) => {
      const id = named(request, reply, request.query.name ?? '');
      if (id === undefined) return;
      return performReadContest(request, reply, id);
    },
  );

  app.get<{ Querystring: { name?: string } }>(
    '/contests/by-name/tally',
    { preHandler: requireSession },
    async (request, reply) => {
      const id = named(request, reply, request.query.name ?? '');
      if (id === undefined) return;
      return performTally(request, reply, id);
    },
  );

  app.get<{ Querystring: { name?: string } }>(
    '/contests/by-name/results',
    { preHandler: requireSession },
    async (request, reply) => {
      const id = named(request, reply, request.query.name ?? '');
      if (id === undefined) return;
      return performResults(request, reply, id);
    },
  );

  app.post<{ Body: { contest?: string } }>(
    '/contests/by-name/close',
    { preHandler: requireSession },
    async (request, reply) => {
      const id = named(request, reply, request.body?.contest ?? '');
      if (id === undefined) return;
      return performClose(request, reply, id);
    },
  );

  app.post<{ Body: { contest?: string } }>(
    '/contests/by-name/reveal',
    { preHandler: requireSession },
    async (request, reply) => {
      const id = named(request, reply, request.body?.contest ?? '');
      if (id === undefined) return;
      return performReveal(request, reply, id);
    },
  );

  app.delete<{ Querystring: { name?: string; confirm?: string } }>(
    '/contests/by-name',
    // The same tightest-in-the-API ceiling the id-addressed delete carries. A
    // second door to the one action with no undo must not be a cheaper one.
    { preHandler: requireSession, config: { rateLimit: SENSITIVE_RATE_LIMIT } },
    async (request, reply) => {
      const id = named(request, reply, request.query.name ?? '');
      if (id === undefined) return;
      return performDelete(request, reply, id, request.query.confirm);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/contests/:id',
    { preHandler: requireSession },
    async (request, reply) => performReadContest(request, reply, request.params.id),
  );

  /**
   * Deleting a contest, at any point in its life. **One route for drafts and
   * published contests alike** — they share an id space, and two routes for one
   * host intent is the "one destination, two paths" shape behind the defects in
   * docs/threat-model.md §4. `DELETE /drafts/:id` was retired into this.
   *
   * `?confirm=<name>` carries the typed-name confirmation. The use case decides
   * whether it is required (once anyone has claimed a place or cast a vote), so
   * the guard holds for the form, the assistant and any MCP client alike rather
   * than living in whichever screen happens to show a dialog.
   */
  app.delete<{ Params: { id: string }; Querystring: { confirm?: string } }>(
    '/contests/:id',
    // Rate-limited like the other sensitive entry points: this is the one action
    // with no undo, and the tightest ceiling in the API is the right one for it.
    { preHandler: requireSession, config: { rateLimit: SENSITIVE_RATE_LIMIT } },
    async (request, reply) => performDelete(request, reply, request.params.id, request.query.confirm),
  );

  /*
   * The operations themselves, each written once and reached two ways: by id from
   * the panel, which already holds the id of the contest it drew, and by name from
   * the assistant, which has only what the host said. Two doors, one room — the
   * alternative is two handlers that agree until the day one of them is changed.
   */
  async function performClose(request: FastifyRequest, reply: FastifyReply, id: string) {
    const contest = owned(request, reply, id);
    if (!contest || !request.hostSession) return;

    const closed = deps.closeContest.execute(id, {
      actorId: request.hostSession.id,
      confirmation: hostConfirmed(request),
      provenance: provenanceOfRequest(request),
    });
    if (!closed.ok) {
      return reply.code(CLOSE_CONTEST_ERROR_STATUS[closed.error.code]).send({ error: closed.error });
    }
    return reply.code(200).send(toContestDto(closed.contest));
  }

  async function performReveal(request: FastifyRequest, reply: FastifyReply, id: string) {
    const contest = owned(request, reply, id);
    if (!contest || !request.hostSession) return;

    const revealed = deps.revealContest.execute(id, {
      actorId: request.hostSession.id,
      confirmation: hostConfirmed(request),
      provenance: provenanceOfRequest(request),
    });
    if (!revealed.ok) {
      return reply.code(REVEAL_CONTEST_ERROR_STATUS[revealed.error.code]).send({ error: revealed.error });
    }
    return reply.code(200).send(toContestDto(revealed.contest));
  }

  async function performDelete(
    request: FastifyRequest,
    reply: FastifyReply,
    id: string,
    confirmName: string | undefined,
  ) {
    if (!request.hostSession) return reply.code(401).send(notSignedIn);

    const deleted = deps.deleteContest.execute(id, request.hostSession.id, {
      confirmName,
      confirmation: hostConfirmed(request),
      provenance: provenanceOfRequest(request),
    });
    if (!deleted.ok) {
      return reply.code(DELETE_CONTEST_ERROR_STATUS[deleted.error.code]).send({ error: deleted.error });
    }
    return reply.code(204).send();
  }

  async function performReadContest(request: FastifyRequest, reply: FastifyReply, id: string) {
    const contest = owned(request, reply, id);
    if (!contest) return;
    const fresh = ensureContestFresh(contest, { contests: deps.contests, clock: deps.clock });
    return reply.code(200).send(toContestDto(fresh));
  }

  async function performResults(request: FastifyRequest, reply: FastifyReply, id: string) {
    const contest = owned(request, reply, id);
    if (!contest) return;

    const results = deps.getResults.execute(id);
    if (!results.ok) {
      return reply.code(GET_RESULTS_ERROR_STATUS[results.error.code]).send({ error: results.error });
    }
    return reply.code(200).send(toResultsDto(results.results));
  }

  async function performTally(request: FastifyRequest, reply: FastifyReply, id: string) {
    const contest = owned(request, reply, id);
    if (!contest) return;

    const tally = deps.getTally.execute(id);
    if (!tally.ok) {
      return reply.code(GET_TALLY_ERROR_STATUS[tally.error.code]).send({ error: tally.error });
    }
    return reply.code(200).send(tally.tally);
  }

  app.post<{ Params: { id: string } }>(
    '/contests/:id/close',
    { preHandler: requireSession },
    async (request, reply) => performClose(request, reply, request.params.id),
  );

  app.post<{ Params: { id: string } }>(
    '/contests/:id/reveal',
    { preHandler: requireSession },
    async (request, reply) => performReveal(request, reply, request.params.id),
  );

  app.get<{ Params: { id: string } }>(
    '/contests/:id/results',
    { preHandler: requireSession },
    async (request, reply) => performResults(request, reply, request.params.id),
  );

  /**
   * The host's own view of a revealed contest — the same display-ready shape the
   * participants read, so both apps can render one view (design: "one reveal
   * view, shared"). Deliberately a route of its own rather than admitting hosts
   * to the voter one: that route takes the contest id from the voter's TOKEN and
   * authorises by token scope, and giving one handler two credentials, two id
   * sources and two rules is the "one destination, two paths" shape that has
   * already produced three defects here (threat-model.md §4). This path
   * authorises by ownership, like every other host contest operation, and is
   * held back (409) until the reveal exactly as the participants' is.
   *
   * Named `/winners` rather than `/reveal`: that path is already spoken for by
   * the voter's GET and by the host's POST that triggers the reveal, and Fastify
   * matches on path shape, so `:id` and `:contestId` are the same route.
   */
  app.get<{ Params: { id: string } }>(
    '/contests/:id/winners',
    { preHandler: requireSession },
    async (request, reply) => {
      if (!request.hostSession) return reply.code(401).send(notSignedIn);

      const contest = deps.getContest.execute(request.params.id);
      if (!contest) {
        return reply
          .code(404)
          .send({ error: { code: 'CONTEST_NOT_FOUND', message: 'No such contest.' } });
      }
      if (contest.hostId !== request.hostSession.id) return reply.code(403).send(notAllowed);

      const results = deps.getResults.execute(request.params.id);
      if (!results.ok) {
        return reply
          .code(GET_RESULTS_ERROR_STATUS[results.error.code])
          .send({ error: results.error });
      }

      /*
       * The same naming the participant's reveal is built from — including the
       * cooks, which this payload carries and the host's screen does not draw.
       * That is not an oversight: the field belongs to the result, both routes
       * describe the same result, and a payload that differed by route is how
       * two screens quietly stop agreeing.
       */
      const naming = dishNaming(
        contest.materialized,
        deps.dishes.findByContest(contest.id),
        deps.roster.listAll(contest.id),
      );
      return reply
        .code(200)
        .send(toRevealDto(contest.name, contest.materialized.categories, results.results, naming));
    },
  );

  app.get<{ Params: { id: string } }>(
    '/contests/:id/tally',
    { preHandler: requireSession },
    async (request, reply) => performTally(request, reply, request.params.id),
  );
}
