import type { FastifyInstance } from 'fastify';
import type { SubmitDishErrorCode } from '../dishes/use-cases/shared.js';
import type { SaveScoreErrorCode, SendVoteErrorCode } from '../scoring/use-cases/shared.js';
import type { ClaimErrorCode } from '../voters/use-cases/shared.js';
import { SENSITIVE_RATE_LIMIT } from './rate-limit.js';
import { refuseDeletedContest } from './refuse-deleted-contest.js';
import { requireVoterSession } from './require-voter-session.js';
import type { ServerDeps } from './server-deps.js';
import { setVoterCookie } from './session-cookies.js';
import { toRevealDto } from '../contests/reveal-dto.js';

interface ClaimBody {
  readonly participantId: string;
}

interface DishBody {
  readonly name: string;
  readonly description?: string;
}

interface ScoreBody {
  readonly dishId: string;
  readonly categoryId: string;
  readonly value: number;
}

const CLAIM_ERROR_STATUS: Record<ClaimErrorCode, number> = {
  JOIN_CODE_NOT_FOUND: 404,
  NO_SUCH_PLACE: 404,
  PLACE_TAKEN: 409,
};

const SUBMIT_DISH_ERROR_STATUS: Record<SubmitDishErrorCode, number> = {
  NAME_REQUIRED: 400,
  NO_DISH_FOR_PARTICIPANT: 403,
  CONTEST_CLOSED: 409,
};

const SAVE_SCORE_ERROR_STATUS: Record<SaveScoreErrorCode, number> = {
  CONTEST_NOT_FOUND: 404,
  DISH_NOT_OPEN: 403,
  UNKNOWN_CATEGORY: 400,
  OUT_OF_RANGE: 400,
  SESSION_LOCKED: 409,
  CONTEST_CLOSED: 409,
};

const SEND_VOTE_ERROR_STATUS: Record<SendVoteErrorCode, number> = {
  CONTEST_NOT_FOUND: 404,
  NO_VOTE_SESSION: 400,
  ALREADY_SENT: 409,
  INCOMPLETE: 422,
  DUPLICATE_CATEGORY_VALUE: 422,
  CONTEST_CLOSED: 409,
};

const notSignedIn = { error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' } };

export function registerVoterRoutes(app: FastifyInstance, deps: ServerDeps): void {
  // Every voter-scoped route: prove the token, then refuse with 410 if the host
  // has deleted the contest it is scoped to (see refuse-deleted-contest.ts).
  const voterSession = [requireVoterSession(deps), refuseDeletedContest(deps)];
  app.get<{ Params: { joinCode: string } }>(
    '/contests/:joinCode/places',
    async (request, reply) => {
      const contest = deps.contests.findByJoinCode(request.params.joinCode);
      if (!contest) {
        return reply
          .code(404)
          .send({ error: { code: 'JOIN_CODE_NOT_FOUND', message: 'No such join code.' } });
      }
      /*
       * The WHOLE roster, not only what is still open. A person holding the code
       * needs to tell "someone already took my name" apart from "this is the
       * wrong contest", and a contest with nothing left has to be able to explain
       * itself rather than show an empty list.
       *
       * This does mean the code discloses who has already arrived. Accepted, and
       * bounded: these are the names the host listed and everyone in the room can
       * see, `claimedAt` is reduced to a boolean so no arrival *times* leak, and
       * nothing else about a person is attached. Claiming is still refused for a
       * taken place — the roster widened, the rule did not.
       */
      const places = deps.roster.listAll(contest.id).map((place) => ({
        participantId: place.participantId,
        displayName: place.displayName,
        taken: place.claimedAt !== null,
      }));
      return reply.code(200).send({ contestId: contest.id, places });
    },
  );

  app.post<{ Params: { joinCode: string }; Body: ClaimBody }>(
    '/contests/:joinCode/claim',
    { config: { rateLimit: SENSITIVE_RATE_LIMIT } },
    async (request, reply) => {
      const claim = deps.claimPlace.execute(request.params.joinCode, request.body.participantId);
      if (!claim.ok)
        return reply.code(CLAIM_ERROR_STATUS[claim.error.code]).send({ error: claim.error });
      setVoterCookie(reply, claim.session, deps.cookieTransport);
      return reply.code(201).send({
        participantId: claim.participantId,
        contestId: claim.contestId,
        displayName: claim.displayName,
      });
    },
  );

  app.get<{ Params: { contestId: string } }>(
    '/contests/:contestId/me',
    { preHandler: voterSession },
    async (request, reply) => {
      if (!request.voterSession) return reply.code(401).send(notSignedIn);

      const place = deps.roster.find(request.voterSession.contestId, request.voterSession.id);
      if (!place) return reply.code(401).send(notSignedIn);
      return reply.code(200).send({
        participantId: place.participantId,
        contestId: place.contestId,
        displayName: place.displayName,
      });
    },
  );

  app.post<{ Params: { contestId: string }; Body: DishBody }>(
    '/contests/:contestId/dishes',
    { preHandler: voterSession },
    async (request, reply) => {
      if (!request.voterSession) return reply.code(401).send(notSignedIn);

      const submitted = deps.submitDish.execute(
        request.voterSession.contestId,
        request.voterSession.id,
        {
          name: request.body?.name,
          description: request.body?.description,
        },
      );
      if (!submitted.ok) {
        return reply
          .code(SUBMIT_DISH_ERROR_STATUS[submitted.error.code])
          .send({ error: submitted.error });
      }
      return reply.code(201).send(submitted.dish);
    },
  );

  app.get<{ Params: { contestId: string } }>(
    '/contests/:contestId/dishes',
    { preHandler: voterSession },
    async (request, reply) => {
      if (!request.voterSession) return reply.code(401).send(notSignedIn);
      return reply
        .code(200)
        .send({ dishes: deps.dishes.findByContest(request.voterSession.contestId) });
    },
  );

  app.post<{ Params: { contestId: string }; Body: ScoreBody }>(
    '/contests/:contestId/scores',
    { preHandler: voterSession },
    async (request, reply) => {
      if (!request.voterSession) return reply.code(401).send(notSignedIn);

      const saved = deps.saveScore.execute(
        request.voterSession.contestId,
        request.voterSession.id,
        {
          dishId: request.body?.dishId,
          categoryId: request.body?.categoryId,
          value: request.body?.value,
        },
      );
      if (!saved.ok)
        return reply.code(SAVE_SCORE_ERROR_STATUS[saved.error.code]).send({ error: saved.error });
      return reply.code(201).send(saved.score);
    },
  );

  app.get<{ Params: { contestId: string } }>(
    '/contests/:contestId/scores',
    { preHandler: voterSession },
    async (request, reply) => {
      if (!request.voterSession) return reply.code(401).send(notSignedIn);
      // `{ scores, status }` — the status is what lets the app tell a sent vote
      // from a draft after a reload, instead of remembering it in the screen.
      return reply
        .code(200)
        .send(deps.getMyScores.execute(request.voterSession.contestId, request.voterSession.id));
    },
  );

  app.get<{ Params: { contestId: string } }>(
    '/contests/:contestId/ballot',
    { preHandler: voterSession },
    async (request, reply) => {
      if (!request.voterSession) return reply.code(401).send(notSignedIn);

      const ballot = deps.getBallot.execute(request.voterSession.contestId, request.voterSession.id);
      if (!ballot.ok) return reply.code(404).send({ error: ballot.error });
      return reply.code(200).send(ballot.ballot);
    },
  );

  // The participant view of a revealed contest — held back (409) until the host
  // reveals, which the app polls on. Distinct from the host's `/results`.
  app.get<{ Params: { contestId: string } }>(
    '/contests/:contestId/reveal',
    { preHandler: voterSession },
    async (request, reply) => {
      if (!request.voterSession) return reply.code(401).send(notSignedIn);
      const contestId = request.voterSession.contestId;

      const results = deps.getResults.execute(contestId);
      if (!results.ok) {
        return reply
          .code(results.error.code === 'NOT_REVEALED' ? 409 : 404)
          .send({ error: results.error });
      }

      const contest = deps.getContest.execute(contestId);
      if (!contest) {
        return reply
          .code(404)
          .send({ error: { code: 'CONTEST_NOT_FOUND', message: 'No such contest.' } });
      }
      const names = new Map(deps.dishes.findByContest(contestId).map((d) => [d.dishId, d.name]));
      const dto = toRevealDto(
        contest.name,
        contest.materialized.categories,
        results.results,
        (dishId) => names.get(dishId) ?? 'A dish',
      );
      return reply.code(200).send(dto);
    },
  );

  app.post<{ Params: { contestId: string } }>(
    '/contests/:contestId/send-vote',
    { preHandler: voterSession },
    async (request, reply) => {
      if (!request.voterSession) return reply.code(401).send(notSignedIn);

      const sent = deps.sendVote.execute(request.voterSession.contestId, request.voterSession.id);
      if (!sent.ok)
        return reply.code(SEND_VOTE_ERROR_STATUS[sent.error.code]).send({ error: sent.error });
      return reply.code(200).send(sent.session);
    },
  );
}
