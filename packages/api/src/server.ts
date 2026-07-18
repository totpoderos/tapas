import Fastify, { type FastifyInstance } from 'fastify';

/**
 * Builds the Fastify app. Routes, auth, and security middleware (Helmet, CORS
 * allowlist, rate limiting) are added in Phase 2. For now it exposes a health
 * check so the skeleton is drivable end-to-end.
 */
export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
