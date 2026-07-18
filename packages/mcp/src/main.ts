import { loadEnv } from './config/env.js';
import { buildServer } from './server.js';

const env = loadEnv();
const app = buildServer(env.API_BASE_URL);

app
  .listen({ port: env.MCP_PORT, host: '0.0.0.0' })
  .then((address) => {
    console.log(`[mcp] listening on ${address} — API at ${env.API_BASE_URL}`);
  })
  .catch((error) => {
    console.error('[mcp] failed to start:', error);
    process.exit(1);
  });
