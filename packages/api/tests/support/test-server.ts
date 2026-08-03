import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildProductionDeps } from '../../src/composition.js';
import { buildServer } from '../../src/server.js';
import type { Database } from '../../src/db/database.js';
import { freshDatabase } from './test-database.js';
import { InMemoryMailer } from '../../src/mail/mailer.js';
import { BcryptPasswordHasher, StubLLMClient, type Clock, type Env, type LLMClient } from '../../src/index.js';

const TEST_BCRYPT_COST = 4; // keeps HTTP-level tests fast; production uses 12

const BASE_ENV: Env = {
  NODE_ENV: 'test',
  API_PORT: 3000,
  DATABASE_DRIVER: 'sqlite',
  DATABASE_PATH: ':memory:',
  DATABASE_URL: '',
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters',
  HOST_WEB_ORIGIN: 'http://localhost:5173',
  PARTICIPANT_WEB_ORIGIN: 'http://localhost:5174',
  LLM_BASE_URL: 'http://localhost:11434/v1',
  LLM_API_KEY: '',
  LLM_MODEL: 'llama3.1',
  ASSISTANT_CONFIRMATION_SECRET: 'test-assistant-confirmation-secret-32chars',
  ASSISTANT_STUB: 0,
  ADMIN_BOOTSTRAP_EMAIL: 'admin@example.com',
  MAIL_TRANSPORT: 'smtp',
  MAIL_HOST: 'localhost',
  MAIL_PORT: 1025,
  MAIL_SECURE: false,
  MAIL_USER: '',
  MAIL_PASSWORD: '',
  MAIL_FROM: 'no-reply@tapas.example',
};

export interface TestApp {
  readonly app: FastifyInstance;
  /**
   * The database behind the app — lets a spec seed state (e.g. a live contest)
   * or read a row back directly.
   *
   * The port rather than a SQLite connection, because these specs run against
   * either database. A spec that reached for `node:sqlite` would be a spec that
   * only ever proved one of them.
   */
  readonly database: Database;
  /** What the app has "sent" — how a spec gets an invitation link the way its recipient would. */
  readonly mailer: InMemoryMailer;
}

/** A fully-wired server over a fresh in-memory SQLite database, for HTTP-level acceptance tests. */
export async function makeTestApp(
  clock?: Clock,
  envOverrides: Partial<Env> = {},
  llmClient: LLMClient = new StubLLMClient(),
  mailer: InMemoryMailer = new InMemoryMailer(),
): Promise<TestApp> {
  const { database } = await freshDatabase();
  const deps = buildProductionDeps(
    database,
    { ...BASE_ENV, ...envOverrides },
    clock,
    new BcryptPasswordHasher(TEST_BCRYPT_COST),
    llmClient,
    mailer,
  );
  const app = buildServer(deps);
  databaseOf.set(app, database);
  return { app, database, mailer };
}

/**
 * Another instance of the same deployment: a second app over the same database.
 *
 * What a spec needs to say anything at all about counting across instances —
 * two apps that share nothing look identical to two that share a database when
 * each is asked on its own.
 */
export async function makeTestAppOn(
  database: Database,
  clock?: Clock,
  envOverrides: Partial<Env> = {},
): Promise<Omit<TestApp, 'mailer'>> {
  const deps = buildProductionDeps(
    database,
    { ...BASE_ENV, ...envOverrides },
    clock,
    new BcryptPasswordHasher(TEST_BCRYPT_COST),
    new StubLLMClient(),
  );
  const app = buildServer(deps);
  databaseOf.set(app, database);
  return { app, database };
}

/**
 * A server for a deployment that sends no mail — wired the way production wires
 * it, from `MAIL_TRANSPORT`, so the specs exercise the real choice rather than a
 * stand-in for it.
 *
 * The mailer is left for `buildProductionDeps` to pick, which is the whole point:
 * a spec that handed a `NoMailer` in directly would prove the invitation flow
 * copes with a refusing transport (already covered) and prove nothing about the
 * setting that selects one.
 */
export async function makeTestAppWithoutMail(clock?: Clock): Promise<Omit<TestApp, 'mailer'>> {
  const { database } = await freshDatabase();
  const deps = buildProductionDeps(
    database,
    { ...BASE_ENV, MAIL_TRANSPORT: 'none' },
    clock,
    new BcryptPasswordHasher(TEST_BCRYPT_COST),
    new StubLLMClient(),
  );
  const app = buildServer(deps);
  databaseOf.set(app, database);
  return { app, database };
}

/**
 * The database behind an app, so a fixture can be asked for by the thing every
 * spec already holds.
 *
 * Seeding needs the database; the helpers that create hosts hold the app. This
 * is what lets `seedHost` take an app, rather than twenty-odd files threading a
 * second argument through every helper and every call site to reach it.
 */
const databaseOf = new WeakMap<FastifyInstance, Database>();

/**
 * Gives a host an account, directly in the database, with a real bcrypt hash so
 * they can sign in through the ordinary path.
 *
 * Nothing in the application creates an account except accepting an invitation,
 * and running that flow in every spec that merely needs a host would make a
 * tally spec fail when invitation expiry breaks. How a host came to exist is
 * not what these specs are about — this says "fixture" and stops pretending
 * otherwise. The specs that *are* about it still do it the long way.
 *
 * Idempotent: asking twice for the same address leaves the first account
 * alone. Registering twice used to be a harmless refusal that specs ignored,
 * and a fixture should not be stricter than the thing it replaced.
 */
export async function seedHost(
  app: FastifyInstance,
  email: string,
  password: string,
  role: 'host' | 'admin' = 'host',
): Promise<void> {
  const db = databaseOf.get(app);
  if (!db)
    throw new Error(
      'seedHost needs an app from makeTestApp(); use seedHostIn(db, …) for an app built by hand',
    );
  return seedHostIn(db, email, password, role);
}

/** The same fixture, for a caller that holds the database rather than the app. */
export async function seedHostIn(
  db: Database,
  email: string,
  password: string,
  role: 'host' | 'admin' = 'host',
): Promise<void> {
  const already = await db.prepare('SELECT 1 FROM host_accounts WHERE email = ?').get(email);
  if (already) return;

  const passwordHash = await new BcryptPasswordHasher(TEST_BCRYPT_COST).hash(password);
  await db
    .prepare(
      `INSERT INTO host_accounts (id, email, password_hash, role, failed_attempts, locked_until, created_at)
     VALUES (?, ?, ?, ?, 0, NULL, ?)`,
    )
    .run(randomUUID(), email, passwordHash, role, new Date().toISOString());
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
export async function promoteToAdministrator(db: Database, email: string): Promise<void> {
  const result = await db.prepare(`UPDATE host_accounts SET role = 'admin' WHERE email = ?`).run(email);
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
