import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  buildProductionDeps,
  buildServer,
  loadEnv,
  openConfiguredDatabase,
  runMigrations,
} from '@tapas/api';

/**
 * The API as one serverless function.
 *
 * `main.ts` is the other entry point — the long-lived process a container or a
 * VPS runs, which listens on a port. This one never listens: a platform hands it
 * a request and a response and expects them handled. Both build the same server
 * from the same dependencies; only how a request arrives differs.
 *
 * Every API path is routed here by `vercel.json`, which is what keeps the app
 * and the API on one origin. The session cookie is httpOnly and first-party, and
 * a rewrite is a server-side proxy rather than a redirect, so the browser never
 * learns that two things are answering.
 */

/**
 * Built once per cold start, not once per request.
 *
 * A platform keeps a warm instance between requests, so this is amortised over
 * however many it serves before being recycled. Migrations run here too, guarded
 * by the advisory lock the runner takes on Postgres — several instances starting
 * at once is the ordinary case here, not the exotic one.
 */
let starting: Promise<ReturnType<typeof buildServer>> | null = null;

async function server() {
  starting ??= (async () => {
    const env = loadEnv();
    const database = await openConfiguredDatabase(env);
    await runMigrations(database);
    const app = buildServer(buildProductionDeps(database, env));
    await app.ready();
    return app;
  })();
  return starting;
}

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const app = await server();
  app.server.emit('request', request, response);
}
