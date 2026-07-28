import type { FastifyInstance } from 'fastify';
import { requireAdministrator } from './require-administrator.js';
import { requireHostSession } from './require-host-session.js';
import type { ServerDeps } from './server-deps.js';

/**
 * Work reserved to an administrator. Every route here composes both steps:
 * `requireHostSession` answers "not signed in", `requireAdministrator` answers
 * "not allowed", and the refusal is logged by the latter for all of them.
 */
export function registerAdminRoutes(app: FastifyInstance, deps: ServerDeps): void {
  const preHandler = [requireHostSession(deps), requireAdministrator(deps)];

  app.get('/admin/hosts', { preHandler }, async (_request, reply) => {
    return reply.code(200).send({ hosts: deps.listHostAccounts.execute() });
  });
}
