import { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { buildProductionDeps } from '../../src/composition.js';
import { runMigrations } from '../../src/db/migrate.js';
import { buildServer } from '../../src/server.js';
import { BcryptPasswordHasher, type Clock } from '../../src/index.js';

const TEST_BCRYPT_COST = 4; // keeps HTTP-level tests fast; production uses 12

/** A fully-wired server over a fresh in-memory SQLite database, for HTTP-level acceptance tests. */
export function makeTestApp(clock?: Clock): FastifyInstance {
  const db = new DatabaseSync(':memory:');
  runMigrations(db);
  const deps = buildProductionDeps(
    db,
    {
      NODE_ENV: 'test',
      API_PORT: 3000,
      DATABASE_PATH: ':memory:',
      JWT_SECRET: 'test-secret-that-is-at-least-32-characters',
    },
    clock,
    new BcryptPasswordHasher(TEST_BCRYPT_COST),
  );
  return buildServer(deps);
}

/** A clock whose time can be advanced mid-test, to exercise token expiry without waiting for real time. */
export class MutableClock implements Clock {
  private current: number;
  constructor(startIso: string) {
    this.current = Date.parse(startIso);
  }
  now(): string {
    return new Date(this.current).toISOString();
  }
  advance(millis: number): void {
    this.current += millis;
  }
}
