import type { FastifyError, FastifyInstance } from 'fastify';

/**
 * In production, replaces any unhandled error with a generic response — no
 * stack trace, no internal message (design.md §11B.4/§11B.9, OWASP A05).
 * Outside production, Fastify's own default (helpful for debugging) stands.
 */
export function registerErrorHandling(app: FastifyInstance, isProduction: boolean): void {
  if (!isProduction) return;

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    reply.code(error.statusCode ?? 500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
    });
  });
}
