import type { FastifyInstance } from 'fastify';
import { requireVoterSession } from './require-voter-session.js';
import type { ServerDeps } from './server-deps.js';
import { setVoterCookie } from './session-cookies.js';

interface JoinBody {
  readonly displayName: string;
}

export function registerVoterRoutes(app: FastifyInstance, deps: ServerDeps): void {
  app.post<{ Params: { joinCode: string }; Body: JoinBody }>(
    '/contests/:joinCode/join',
    async (request, reply) => {
      const joinOutcome = deps.joinContest.execute(
        request.params.joinCode,
        request.body.displayName,
      );
      if (!joinOutcome.ok) {
        return reply.code(404).send({ error: joinOutcome.error });
      }
      setVoterCookie(reply, joinOutcome.session, deps.cookies);
      return reply.code(201).send({
        personId: joinOutcome.voterId,
        contestId: joinOutcome.contestId,
        displayName: request.body.displayName,
      });
    },
  );

  app.get<{ Params: { contestId: string } }>(
    '/contests/:contestId/me',
    { preHandler: requireVoterSession(deps) },
    async (request, reply) => {
      if (!request.voterSession)
        return reply
          .code(401)
          .send({ error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' } });

      const voter = deps.voters.findById(request.voterSession.id);
      if (!voter)
        return reply
          .code(401)
          .send({ error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' } });
      return reply
        .code(200)
        .send({ personId: voter.id, contestId: voter.contestId, displayName: voter.displayName });
    },
  );
}
