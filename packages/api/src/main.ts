import { loadEnv } from './config/env.js';
import { buildProductionDeps } from './composition.js';
import { openDatabase, runMigrations } from './db/migrate.js';
import { buildServer } from './server.js';

const env = loadEnv();
const db = openDatabase(env.DATABASE_PATH);
runMigrations(db);
const app = buildServer(buildProductionDeps(db, env));

app
  .listen({ port: env.API_PORT, host: '0.0.0.0' })
  .then((address) => {
    console.log(`[api] listening on ${address}`);
  })
  .catch((error) => {
    console.error('[api] failed to start:', error);
    process.exit(1);
  });
