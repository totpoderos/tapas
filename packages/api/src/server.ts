import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerAuthRoutes } from './http/auth-routes.js';
import { registerDraftRoutes } from './http/draft-routes.js';
import { registerVoterRoutes } from './http/voter-routes.js';
import type { ServerDeps } from './http/server-deps.js';

export type { ServerDeps } from './http/server-deps.js';

/**
 * Builds the Fastify app: host auth (register/login/refresh/logout) with
 * httpOnly session cookies, and the protected draft endpoints behind them.
 * Security middleware (Helmet, CORS, rate limiting) lands in Slice C3.
 */
export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: false });

  app.register(cookie);

  app.get('/health', async () => ({ status: 'ok' }));

  registerAuthRoutes(app, deps);
  registerDraftRoutes(app, deps);
  registerVoterRoutes(app, deps);

  return app;
}
