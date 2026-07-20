import type { FastifyInstance } from 'fastify';
import { requireHostSession } from './require-host-session.js';
import type { ServerDeps } from './server-deps.js';

const notSignedIn = { error: { code: 'NOT_SIGNED_IN', message: 'Sign in required.' } };
const notAllowed = { error: { code: 'NOT_ALLOWED', message: 'Not allowed.' } };

/** Host-scoped contest reads. Voter-scoped contest routes live in voter-routes.ts. */
export function registerContestRoutes(app: FastifyInstance, deps: ServerDeps): void {
  const requireSession = requireHostSession(deps);

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
      return reply.code(200).send(contest);
    },
  );
}
