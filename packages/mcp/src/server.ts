import Fastify, { type FastifyInstance } from 'fastify';
import { TOOL_CATALOG } from './tool-catalog.js';

/**
 * The MCP server skeleton. The real protocol transport and tool dispatch land
 * in Phase 4; the adapter owns no business logic. Its `/health` reaches the
 * backend API, proving the adapter → API path is wired.
 */
export function buildServer(apiBaseUrl: string): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get('/health', async () => {
    let api = 'unreachable';
    try {
      const res = await fetch(`${apiBaseUrl}/health`);
      const body = (await res.json()) as { status: string };
      api = body.status;
    } catch {
      // leave 'unreachable'
    }
    return { status: 'ok', api, tools: TOOL_CATALOG.length };
  });

  return app;
}
