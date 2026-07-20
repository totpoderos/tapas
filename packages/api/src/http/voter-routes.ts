import type { FastifyInstance } from 'fastify';
import type { ClaimErrorCode } from '../voters/use-cases/shared.js';
import { SENSITIVE_RATE_LIMIT } from './rate-limit.js';
import { requireVoterSession } from './require-voter-session.js';
import type { ServerDeps } from './server-deps.js';
import { setVoterCookie } from './session-cookies.js';

interface ClaimBody {
  readonly participantId: string;
}

const CLAIM_ERROR_STATUS: Record<ClaimErrorCode, number> = {
  JOIN_CODE_NOT_FOUND: 404,
  NO_SUCH_PLACE: 404,
  PLACE_TAKEN: 409,
};

const notSignedIn = { error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' } };

export function registerVoterRoutes(app: FastifyInstance, deps: ServerDeps): void {
  app.get<{ Params: { joinCode: string } }>(
    '/contests/:joinCode/places',
    async (request, reply) => {
      const contest = deps.contests.findByJoinCode(request.params.joinCode);
      if (!contest) {
        return reply
          .code(404)
          .send({ error: { code: 'JOIN_CODE_NOT_FOUND', message: 'No such join code.' } });
      }
      const places = deps.roster
        .listAvailable(contest.id)
        .map((place) => ({ participantId: place.participantId, displayName: place.displayName }));
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
      setVoterCookie(reply, claim.session);
      return reply
        .code(201)
        .send({
          participantId: claim.participantId,
          contestId: claim.contestId,
          displayName: claim.displayName,
        });
    },
  );

  app.get<{ Params: { contestId: string } }>(
    '/contests/:contestId/me',
    { preHandler: requireVoterSession(deps) },
    async (request, reply) => {
      if (!request.voterSession) return reply.code(401).send(notSignedIn);

      const place = deps.roster.find(request.voterSession.contestId, request.voterSession.id);
      if (!place) return reply.code(401).send(notSignedIn);
      return reply
        .code(200)
        .send({
          participantId: place.participantId,
          contestId: place.contestId,
          displayName: place.displayName,
        });
    },
  );
}
