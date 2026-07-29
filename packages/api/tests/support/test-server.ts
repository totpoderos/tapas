import { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { buildProductionDeps } from '../../src/composition.js';
import { runMigrations } from '../../src/db/migrate.js';
import { buildServer } from '../../src/server.js';
import { InMemoryMailer } from '../../src/mail/mailer.js';
import { BcryptPasswordHasher, StubLLMClient, type Clock, type Env, type LLMClient } from '../../src/index.js';

const TEST_BCRYPT_COST = 4; // keeps HTTP-level tests fast; production uses 12

const BASE_ENV: Env = {
  NODE_ENV: 'test',
  API_PORT: 3000,
  DATABASE_PATH: ':memory:',
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters',
  HOST_WEB_ORIGIN: 'http://localhost:5173',
  PARTICIPANT_WEB_ORIGIN: 'http://localhost:5174',
  LLM_BASE_URL: 'http://localhost:11434/v1',
  LLM_API_KEY: '',
  LLM_MODEL: 'llama3.1',
  ASSISTANT_CONFIRMATION_SECRET: 'test-assistant-confirmation-secret-32chars',
  ASSISTANT_STUB: 0,
};

export interface TestApp {
  readonly app: FastifyInstance;
  /** The in-memory database behind the app — lets a spec seed state (e.g. a live contest) directly. */
  readonly db: DatabaseSync;
  /** What the app has "sent" — how a spec gets an invitation link the way its recipient would. */
  readonly mailer: InMemoryMailer;
}

/** A fully-wired server over a fresh in-memory SQLite database, for HTTP-level acceptance tests. */
export function makeTestApp(
  clock?: Clock,
  envOverrides: Partial<Env> = {},
  llmClient: LLMClient = new StubLLMClient(),
): TestApp {
  const db = new DatabaseSync(':memory:');
  runMigrations(db);
  const deps = buildProductionDeps(
    db,
    { ...BASE_ENV, ...envOverrides },
    clock,
    new BcryptPasswordHasher(TEST_BCRYPT_COST),
    llmClient,
  );
  return { app: buildServer(deps), db, mailer: deps.mailer as InMemoryMailer };
}

/**
 * Promotes an already-registered host to administrator, directly in the database.
 *
 * Nothing in the application assigns the `admin` role yet — creating an
 * administrator arrives with the enrollment bootstrap slice — so a spec that
 * needs one seeds it here. Promoting a real registration rather than inserting
 * a synthetic row keeps the password hash real, so the seeded administrator can
 * actually sign in. Test support only: there is deliberately no production path.
 */
export function promoteToAdministrator(db: DatabaseSync, email: string): void {
  const result = db.prepare(`UPDATE host_accounts SET role = 'admin' WHERE email = ?`).run(email);
  if (result.changes !== 1) throw new Error(`No host account to promote for "${email}"`);
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
