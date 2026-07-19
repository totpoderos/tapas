import type { FastifyInstance } from 'fastify';

/**
 * Forces HTTP -> HTTPS in production (design.md §11B.4). The app is built
 * with `trustProxy: true`, so `request.protocol` reflects `X-Forwarded-Proto`
 * behind a reverse proxy rather than the raw (likely unencrypted) socket.
 */
export function registerHttpsRedirect(app: FastifyInstance, isProduction: boolean): void {
  if (!isProduction) return;

  app.addHook('onRequest', async (request, reply) => {
    if (request.protocol !== 'https') {
      await reply.redirect(`https://${request.hostname}${request.url}`, 301);
    }
  });
}
