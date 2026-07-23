import { DatabaseSync } from 'node:sqlite';
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
};

const FIXED_CLOCK: Clock = { now: () => '2026-07-19T10:00:00.000Z' };

export interface RunningApi {
  readonly app: FastifyInstance;
  readonly baseUrl: string;
  close(): Promise<void>;
}

/** Builds the API and starts it listening on a free port; returns its base URL. */
export async function startApi(): Promise<RunningApi> {
  const db = new DatabaseSync(':memory:');
  runMigrations(db);
  const deps = buildProductionDeps(db, BASE_ENV, FIXED_CLOCK, new BcryptPasswordHasher(4), new StubLLMClient());
  const app = buildServer(deps);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  if (address === null || typeof address === 'string') throw new Error('API did not bind a port');
  return {
    app,
    baseUrl: `http://127.0.0.1:${address.port}`,
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
  attribution: 'per_person',
  antiBias: 'none',
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
function asBearer(app: FastifyInstance, token: string, method: 'GET' | 'POST', url: string, payload?: object) {
  return app.inject({ method, url, payload, headers: { authorization: `Bearer ${token}` } });
}

/** Registers and logs in a host, then issues a personal access token. Returns the token. */
export async function hostWithToken(app: FastifyInstance, email: string): Promise<string> {
  const jar = new CookieJar();
  await asHost(app, jar, 'POST', '/auth/register', { email, password: STRONG_PASSWORD });
  await asHost(app, jar, 'POST', '/auth/login', { email, password: STRONG_PASSWORD });
  const issued = await asHost(app, jar, 'POST', '/auth/pats');
  return issued.json().token as string;
}

/** Saves a draft as the given host (by bearer token) and returns its id. */
export async function saveDraftAs(app: FastifyInstance, token: string): Promise<string> {
  const created = await asBearer(app, token, 'POST', '/drafts', DRAFT_CONTENT);
  return created.json().id as string;
}

/** Publishes a live contest as the given host (by bearer token) and returns its id; reusable for several. */
export async function publishContestAs(app: FastifyInstance, token: string): Promise<string> {
  const draftId = await saveDraftAs(app, token);
  const published = await asBearer(app, token, 'POST', `/drafts/${draftId}/publish`);
  return published.json().id as string;
}

/** Registers/logs in a host, saves a simple draft as them, and returns its id and token. */
export async function hostWithDraft(
  app: FastifyInstance,
  email: string,
): Promise<{ token: string; draftId: string }> {
  const token = await hostWithToken(app, email);
  return { token, draftId: await saveDraftAs(app, token) };
}

/** Registers/logs in a host, publishes a simple live contest as them, and returns its id and token. */
export async function hostWithPublishedContest(
  app: FastifyInstance,
  email: string,
): Promise<{ token: string; contestId: string }> {
  const token = await hostWithToken(app, email);
  return { token, contestId: await publishContestAs(app, token) };
}

/** Registers/logs in a host and publishes then closes a contest — the state a reveal needs. */
export async function hostWithClosedContest(
  app: FastifyInstance,
  email: string,
): Promise<{ token: string; contestId: string }> {
  const token = await hostWithToken(app, email);
  const contestId = await publishContestAs(app, token);
  await asBearer(app, token, 'POST', `/contests/${contestId}/close`);
  return { token, contestId };
}

/** Registers/logs in a host and takes a contest all the way to revealed. */
export async function hostWithRevealedContest(
  app: FastifyInstance,
  email: string,
): Promise<{ token: string; contestId: string }> {
  const { token, contestId } = await hostWithClosedContest(app, email);
  await asBearer(app, token, 'POST', `/contests/${contestId}/reveal`);
  return { token, contestId };
}
