import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerAuthRoutes } from './http/auth-routes.js';
import { registerDraftRoutes } from './http/draft-routes.js';
import { registerErrorHandling } from './http/error-handling.js';
import { registerHttpsRedirect } from './http/https-redirect.js';
import { registerVoterRoutes } from './http/voter-routes.js';
import type { ServerDeps } from './http/server-deps.js';

export type { ServerDeps } from './http/server-deps.js';

/**
 * Builds the Fastify app: host auth (register/login/refresh/logout) with
 * httpOnly session cookies, the protected draft endpoints behind them, voter
 * join, and baseline response hardening (Helmet, CORS allowlist, forced
 * HTTPS + generic errors in production). Rate limiting and security-event
 * logging land in later C3c sub-slices.
 */
export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: false, trustProxy: true });

  app.register(cookie);
  app.register(helmet, { xFrameOptions: { action: 'deny' } });
  app.register(cors, { origin: [...deps.security.allowedOrigins], credentials: true });

  registerHttpsRedirect(app, deps.security.isProduction);
  registerErrorHandling(app, deps.security.isProduction);

  app.get('/health', async () => ({ status: 'ok' }));

  registerAuthRoutes(app, deps);
  registerDraftRoutes(app, deps);
  registerVoterRoutes(app, deps);

  return app;
}
