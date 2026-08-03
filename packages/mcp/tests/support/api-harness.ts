import { DatabaseSync } from 'node:sqlite';
import { seedHostIn } from '../../../api/tests/support/test-server.js';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import {
  BcryptPasswordHasher,
  buildProductionDeps,
  buildServer,
  runMigrations,
  StubLLMClient,
  type Clock,
  type Env,
} from '@tapas/api';
import { SqliteDatabase } from '@tapas/api';

/**
 * A real, fully-wired API over in-memory SQLite, listening on an ephemeral port
 * — so the MCP adapter can reach it over real HTTP exactly as it would in
 * production. Mirrors the API package's own test harness; the MCP acceptance
 * test needs a genuine API, not a stub, to prove the adapter → API path.
 */

const STRONG_PASSWORD = 'Str0ng!Passw0rd';

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
  ADMIN_BOOTSTRAP_EMAIL: 'admin@example.com',
  MAIL_TRANSPORT: 'smtp',
  MAIL_HOST: 'localhost',
  MAIL_PORT: 1025,
  MAIL_SECURE: false,
  MAIL_USER: '',
  MAIL_PASSWORD: '',
  MAIL_FROM: 'no-reply@tapas.example',
};

const FIXED_CLOCK: Clock = { now: () => '2026-07-19T10:00:00.000Z' };

export interface RunningApi {
  readonly app: FastifyInstance;
  readonly baseUrl: string;
  /** The in-memory database behind the API — lets an integration test read the audit log directly. */
  readonly db: DatabaseSync;
  close(): Promise<void>;
}

/** Builds the API and starts it listening on a free port; returns its base URL. */
export async function startApi(): Promise<RunningApi> {
  const db = new DatabaseSync(':memory:');
  const database = new SqliteDatabase(db);
  await runMigrations(database);
  const deps = buildProductionDeps(database, BASE_ENV, FIXED_CLOCK, new BcryptPasswordHasher(4), new StubLLMClient());
  const app = buildServer(deps);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  if (address === null || typeof address === 'string') throw new Error('API did not bind a port');
  return {
    app,
    baseUrl: `http://127.0.0.1:${address.port}`,
    db,
    close: async () => {
      await app.close();
      db.close();
    },
  };
}

/** Carries Set-Cookie across inject() calls, like a browser would. */
class CookieJar {
  private readonly jar = new Map<string, string>();
  capture(response: LightMyRequestResponse): void {
    for (const raw of response.cookies) {
      if (raw.value === '') this.jar.delete(raw.name);
      else this.jar.set(raw.name, raw.value);
    }
  }
  header(): string {
    return [...this.jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

async function asHost(app: FastifyInstance, jar: CookieJar, method: 'GET' | 'POST', url: string, payload?: object) {
  const response = await app.inject({ method, url, payload, headers: { cookie: jar.header() } });
  jar.capture(response);
  return response;
}

/** A simple, publishable draft: Ana/Bob/Carol, no couples, taste 1..5. */
const DRAFT_CONTENT = {
  name: 'Tapas',
  format: 'solo',
  scoring: {
    categories: [{ id: 'taste', name: 'Taste' }],
    range: { type: 'fixed', min: 1, max: 5 },
    uniquePerCategory: false,
  },
  participants: [
    { id: 'ana', displayName: 'Ana' },
    { id: 'bob', displayName: 'Bob' },
    { id: 'carol', displayName: 'Carol' },
  ],
};

/** An external-client call as the host — just the bearer token, no cookies (as the MCP adapter does). */
export function asBearer(app: FastifyInstance, token: string, method: 'GET' | 'POST', url: string, payload?: object) {
  return app.inject({ method, url, payload, headers: { authorization: `Bearer ${token}` } });
}

/** Gives a host an account and logs them in, then issues a personal access token. */
export async function hostWithToken(
  app: FastifyInstance,
  db: DatabaseSync,
  email: string,
): Promise<string> {
  const jar = new CookieJar();
  await seedHostIn(db, email, STRONG_PASSWORD);
  await asHost(app, jar, 'POST', '/auth/login', { email, password: STRONG_PASSWORD });
  const issued = await asHost(app, jar, 'POST', '/auth/pats');
  return issued.json().token as string;
}

/** Saves a draft as the given host (by bearer token) and returns its id. */
export async function saveDraftAs(app: FastifyInstance, token: string): Promise<string> {
  const created = await asBearer(app, token, 'POST', '/drafts', DRAFT_CONTENT);
  return created.json().id as string;
}

/** Saves a draft with a specific name + participant display names as the given host; returns its id. */
export async function saveNamedDraftAs(
  app: FastifyInstance,
  token: string,
  name: string,
  participantNames: readonly string[],
): Promise<string> {
  const created = await asBearer(app, token, 'POST', '/drafts', {
    name,
    participants: participantNames.map((displayName, i) => ({ id: `p${i}`, displayName })),
  });
  return created.json().id as string;
}

/**
 * Saves a draft with a specific name and scoring as the given host; returns its
 * id. For the scoring-shaping specs, which need a draft that is already judged
 * on something in particular before they change it.
 */
export async function saveScoredDraftAs(
  app: FastifyInstance,
  token: string,
  name: string,
  scoring: object,
  participantNames: readonly string[] = ['Ana', 'Bob'],
): Promise<string> {
  const created = await asBearer(app, token, 'POST', '/drafts', {
    name,
    // A format, so the draft is complete enough for publishing to reach the
    // scoring rules — without one it is refused as incomplete first, and a spec
    // about the scoring would never exercise the scoring.
    format: 'solo',
    scoring,
    participants: participantNames.map((displayName, i) => ({ id: `p${i}`, displayName })),
  });
  return created.json().id as string;
}

/** Publishes a live contest as the given host (by bearer token) and returns its id; reusable for several. */
export async function publishContestAs(app: FastifyInstance, token: string): Promise<string> {
  const draftId = await saveDraftAs(app, token);
  const published = await asBearer(app, token, 'POST', `/drafts/${draftId}/publish`);
  return published.json().id as string;
}

/** Publishes a live contest with a specific name as the given host; returns its id. */
export async function publishNamedContestAs(
  app: FastifyInstance,
  token: string,
  name: string,
): Promise<string> {
  const created = await asBearer(app, token, 'POST', '/drafts', { ...DRAFT_CONTENT, name });
  const published = await asBearer(app, token, 'POST', `/drafts/${created.json().id}/publish`);
  return published.json().id as string;
}

/** Gives a host an account and publishes a live contest with a specific name; returns its id and token. */
export async function hostWithNamedContest(
  app: FastifyInstance,
  db: DatabaseSync,
  email: string,
  name: string,
): Promise<{ token: string; contestId: string }> {
  const token = await hostWithToken(app, db, email);
  return { token, contestId: await publishNamedContestAs(app, token, name) };
}

/** Gives a host an account, saves a simple draft as them, and returns its id and token. */
export async function hostWithDraft(
  app: FastifyInstance,
  db: DatabaseSync,
  email: string,
): Promise<{ token: string; draftId: string }> {
  const token = await hostWithToken(app, db, email);
  return { token, draftId: await saveDraftAs(app, token) };
}

/** Gives a host an account, publishes a simple live contest as them, and returns its id and token. */
export async function hostWithPublishedContest(
  app: FastifyInstance,
  db: DatabaseSync,
  email: string,
): Promise<{ token: string; contestId: string }> {
  const token = await hostWithToken(app, db, email);
  return { token, contestId: await publishContestAs(app, token) };
}

/** Gives a host an account and publishes then closes a contest — the state a reveal needs. */
export async function hostWithClosedContest(
  app: FastifyInstance,
  db: DatabaseSync,
  email: string,
): Promise<{ token: string; contestId: string }> {
  const token = await hostWithToken(app, db, email);
  const contestId = await publishContestAs(app, token);
  await asBearer(app, token, 'POST', `/contests/${contestId}/close`);
  return { token, contestId };
}

/** Gives a host an account and takes a contest all the way to revealed. */
export async function hostWithRevealedContest(
  app: FastifyInstance,
  db: DatabaseSync,
  email: string,
): Promise<{ token: string; contestId: string }> {
  const { token, contestId } = await hostWithClosedContest(app, db, email);
  await asBearer(app, token, 'POST', `/contests/${contestId}/reveal`);
  return { token, contestId };
}
