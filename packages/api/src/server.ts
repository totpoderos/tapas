import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerAssistantRoutes } from './http/assistant-routes.js';
import { registerAuthRoutes } from './http/auth-routes.js';
import { registerContestRoutes } from './http/contest-routes.js';
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
 * HTTPS + generic errors in production, rate limiting on sensitive routes).
 * Security-event logging lands in a later C3c sub-slice.
 */
export function buildServer(deps: ServerDeps): FastifyInstance {
  // Logging on in production so the error handler's server-side error records
  // (A09) actually land somewhere; quiet in dev/test.
  const app = Fastify({ logger: deps.security.isProduction, trustProxy: true });

  app.register(cookie);
  app.register(helmet, { xFrameOptions: { action: 'deny' } });
  app.register(cors, { origin: [...deps.security.allowedOrigins], credentials: true });
  // Generous global default (a safety net, not a throttle); sensitive routes
  // (login, join-by-code) override it per-route with SENSITIVE_RATE_LIMIT.
  app.register(rateLimit, { max: 1000, timeWindow: '1 minute' });

  registerHttpsRedirect(app, deps.security.isProduction);
  registerErrorHandling(app, deps.security.isProduction);

  app.get('/health', async () => ({ status: 'ok' }));

  // Deferred until the plugins above have finished loading: @fastify/rate-limit
  // installs an onRoute hook that reads each route's `config.rateLimit` — a
  // route declared before that hook attaches would silently get no override.
  app.after(() => {
    registerAuthRoutes(app, deps);
    registerDraftRoutes(app, deps);
    registerContestRoutes(app, deps);
    registerVoterRoutes(app, deps);
    registerAssistantRoutes(app, deps);
  });

  return app;
}
