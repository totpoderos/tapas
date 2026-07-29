import { fileURLToPath } from 'node:url';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { MutableClock, makeTestApp, seedHost } from '../support/test-server.js';
import { ACCESS_TTL_SECONDS } from '../../src/index.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./host-sessions.feature', import.meta.url)),
);

const STRONG_PASSWORD = 'Str0ng!Passw0rd';

/** Carries `Set-Cookie` across `inject()` calls the way a browser's cookie jar would. */
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

  cookie(name: string): string | undefined {
    return this.jar.get(name);
  }

  has(name: string): boolean {
    return this.jar.has(name);
  }
}

async function request(
  app: FastifyInstance,
  jar: CookieJar,
  options: { method: 'GET' | 'POST'; url: string; payload?: Record<string, unknown> },
): Promise<LightMyRequestResponse> {
  const response: LightMyRequestResponse = await app.inject({
    ...options,
    headers: { cookie: jar.header() },
  });
  jar.capture(response);
  return response;
}

async function registerAndLogin(
  app: FastifyInstance,
  jar: CookieJar,
  email: string,
): Promise<void> {
  await seedHost(app, email, STRONG_PASSWORD);
  await request(app, jar, {
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: STRONG_PASSWORD },
  });
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('A host signs in and receives a session', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('no host is registered with "ana@example.com"', () => {
      ({ app } = makeTestApp());
      jar = new CookieJar();
    });
    When('a host registers and signs in through the API as "ana@example.com"', async () => {
      await seedHost(app, 'ana@example.com', STRONG_PASSWORD);
      response = await request(app, jar, {
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'ana@example.com', password: STRONG_PASSWORD },
      });
    });
    Then('the API grants a session', () => {
      expect(response.statusCode).toBe(200);
      expect(jar.has('access_token')).toBe(true);
      expect(jar.has('refresh_token')).toBe(true);
    });
  });

  Scenario('A signed-in host can do protected work', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a signed-in host "ana@example.com"', async () => {
      ({ app } = makeTestApp());
      jar = new CookieJar();
      await registerAndLogin(app, jar, 'ana@example.com');
    });
    When('that host creates a draft through the API', async () => {
      response = await request(app, jar, {
        method: 'POST',
        url: '/drafts',
        payload: { name: 'Tapas Night' },
      });
    });
    Then('the draft is created', () => {
      expect(response.statusCode).toBe(201);
      expect(response.json().content.name).toBe('Tapas Night');
    });
  });

  Scenario('Protected work is refused when no one is signed in', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('no one is signed in', () => {
      ({ app } = makeTestApp());
      jar = new CookieJar();
    });
    When('a draft is requested through the API', async () => {
      response = await request(app, jar, {
        method: 'POST',
        url: '/drafts',
        payload: { name: 'Tapas Night' },
      });
    });
    Then('the API refuses it as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });

  Scenario("A host cannot act on another host's work", ({ Given, And, When, Then }) => {
    let app: FastifyInstance;
    let anaJar: CookieJar;
    let bobJar: CookieJar;
    let draftId: string;
    let response: LightMyRequestResponse;

    Given('a signed-in host "ana@example.com" who owns a draft', async () => {
      ({ app } = makeTestApp());
      anaJar = new CookieJar();
      await registerAndLogin(app, anaJar, 'ana@example.com');
      const created = await request(app, anaJar, {
        method: 'POST',
        url: '/drafts',
        payload: { name: 'Tapas Night' },
      });
      draftId = created.json().id;
    });
    And('a second signed-in host "bob@example.com"', async () => {
      bobJar = new CookieJar();
      await registerAndLogin(app, bobJar, 'bob@example.com');
    });
    When('"bob@example.com" tries to read that draft through the API', async () => {
      response = await request(app, bobJar, { method: 'GET', url: `/drafts/${draftId}` });
    });
    Then('the API refuses it as not allowed', () => {
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('NOT_ALLOWED');
    });
  });

  Scenario('A host refreshes a session that has aged out', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let clock: MutableClock;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a signed-in host "ana@example.com" whose session has aged out', async () => {
      clock = new MutableClock('2026-07-19T10:00:00.000Z');
      ({ app } = makeTestApp(clock));
      jar = new CookieJar();
      await registerAndLogin(app, jar, 'ana@example.com');

      clock.advance((ACCESS_TTL_SECONDS + 60) * 1000); // past the access token's TTL
      const staleAttempt = await request(app, jar, {
        method: 'POST',
        url: '/drafts',
        payload: { name: 'irrelevant' },
      });
      expect(staleAttempt.statusCode).toBe(401); // sanity: the access token really did age out
    });
    When('that host refreshes the session through the API', async () => {
      response = await request(app, jar, { method: 'POST', url: '/auth/refresh' });
    });
    Then('the API grants a fresh session', () => {
      expect(response.statusCode).toBe(200);
    });
    And('protected work is allowed again', async () => {
      const created = await request(app, jar, {
        method: 'POST',
        url: '/drafts',
        payload: { name: 'Tapas Night' },
      });
      expect(created.statusCode).toBe(201);
    });
  });

  Scenario('Signing out ends the session', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a signed-in host "ana@example.com"', async () => {
      ({ app } = makeTestApp());
      jar = new CookieJar();
      await registerAndLogin(app, jar, 'ana@example.com');
    });
    When('that host signs out through the API', async () => {
      response = await request(app, jar, { method: 'POST', url: '/auth/logout' });
    });
    Then('the former session no longer allows protected work', async () => {
      expect(response.statusCode).toBe(200);
      const afterLogout = await request(app, jar, {
        method: 'POST',
        url: '/drafts',
        payload: { name: 'Tapas Night' },
      });
      expect(afterLogout.statusCode).toBe(401);
    });
  });

  Scenario('A used-up refresh cannot be replayed', ({ Given, When, And, Then }) => {
    let app: FastifyInstance;
    let clock: MutableClock;
    let jar: CookieJar;
    let usedRefreshToken: string | undefined;
    let response: LightMyRequestResponse;

    Given('a signed-in host "ana@example.com" whose session has aged out', async () => {
      clock = new MutableClock('2026-07-19T10:00:00.000Z');
      ({ app } = makeTestApp(clock));
      jar = new CookieJar();
      await registerAndLogin(app, jar, 'ana@example.com');
      clock.advance((ACCESS_TTL_SECONDS + 60) * 1000);
    });
    When('that host refreshes the session through the API', async () => {
      usedRefreshToken = jar.cookie('refresh_token');
      await request(app, jar, { method: 'POST', url: '/auth/refresh' });
    });
    And('someone tries to refresh again with the old, already-used session', async () => {
      response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie: `refresh_token=${usedRefreshToken}` },
      });
    });
    Then('the API refuses it as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });
});
