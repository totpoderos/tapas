import { loadEnv } from './config/env.js';
import { buildServer } from './server.js';

const env = loadEnv();
const app = buildServer();

app
  .listen({ port: env.API_PORT, host: '0.0.0.0' })
  .then((address) => {
    console.log(`[api] listening on ${address}`);
  })
  .catch((error) => {
    console.error('[api] failed to start:', error);
    process.exit(1);
  });
