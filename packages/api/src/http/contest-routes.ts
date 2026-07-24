import type { FastifyInstance } from 'fastify';
import type {
  CloseContestErrorCode,
  GetResultsErrorCode,
  GetTallyErrorCode,
  RevealContestErrorCode,
} from '../contests/use-cases/shared.js';
import { ensureContestFresh } from '../contests/ensure-fresh.js';
import { toResultsDto } from '../contests/results-dto.js';
import { toContestDto } from '../contests/contest-dto.js';
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

/** Host-scoped contest reads. Voter-scoped contest routes live in voter-routes.ts. */
export function registerContestRoutes(app: FastifyInstance, deps: ServerDeps): void {
  const requireSession = requireHostSession(deps);

  app.get('/contests', { preHandler: requireSession }, async (request, reply) => {
    if (!request.hostSession) return reply.code(401).send(notSignedIn);
    return reply.code(200).send(deps.listMyContests.execute(request.hostSession.id));
  });

  app.get<{ Params: { id: string } }>(
    '/contests/:id',
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
      const fresh = ensureContestFresh(contest, { contests: deps.contests, clock: deps.clock });
      return reply.code(200).send(toContestDto(fresh));
    },
  );

  app.post<{ Params: { id: string } }>(
    '/contests/:id/close',
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

      const closed = deps.closeContest.execute(request.params.id);
      if (!closed.ok) {
        return reply
          .code(CLOSE_CONTEST_ERROR_STATUS[closed.error.code])
          .send({ error: closed.error });
      }
      return reply.code(200).send(toContestDto(closed.contest));
    },
  );

  app.post<{ Params: { id: string } }>(
    '/contests/:id/reveal',
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

      const revealed = deps.revealContest.execute(request.params.id);
      if (!revealed.ok) {
        return reply
          .code(REVEAL_CONTEST_ERROR_STATUS[revealed.error.code])
          .send({ error: revealed.error });
      }
      return reply.code(200).send(toContestDto(revealed.contest));
    },
  );

  app.get<{ Params: { id: string } }>(
    '/contests/:id/results',
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
      return reply.code(200).send(toResultsDto(results.results));
    },
  );

  app.get<{ Params: { id: string } }>(
    '/contests/:id/tally',
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

      const tally = deps.getTally.execute(request.params.id);
      if (!tally.ok) {
        return reply.code(GET_TALLY_ERROR_STATUS[tally.error.code]).send({ error: tally.error });
      }
      return reply.code(200).send(tally.tally);
    },
  );
}
