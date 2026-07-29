import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp, promoteToAdministrator, seedHost } from '../support/test-server.js';
import { SqliteSecurityEventLog, SystemClock, UuidIdGenerator } from '../../src/index.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./administrative-access.feature', import.meta.url)),
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
}

async function request(
  app: FastifyInstance,
  jar: CookieJar,
  options: { method: 'GET' | 'POST' | 'DELETE'; url: string; payload?: Record<string, unknown> },
): Promise<LightMyRequestResponse> {
  const response: LightMyRequestResponse = await app.inject({
    ...options,
    headers: { cookie: jar.header() },
  });
  jar.capture(response);
  return response;
}

/** Simulates an external client (e.g. the MCP server): no cookies, just the bearer token. */
async function requestAsExternalClient(
  app: FastifyInstance,
  token: string,
  options: { method: 'GET' | 'POST'; url: string; payload?: Record<string, unknown> },
): Promise<LightMyRequestResponse> {
  return app.inject({ ...options, headers: { authorization: `Bearer ${token}` } });
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

/** Registers the host, promotes them, then signs in — so the session carries the promoted role. */
async function signInAsAdministrator(
  app: FastifyInstance,
  db: DatabaseSync,
  jar: CookieJar,
  email: string,
): Promise<void> {
  await seedHost(app, email, STRONG_PASSWORD);
  promoteToAdministrator(db, email);
  await request(app, jar, {
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: STRONG_PASSWORD },
  });
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('An administrator sees the list of host accounts', ({ Given, And, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let adminJar: CookieJar;
    let response: LightMyRequestResponse;

    Given('an administrator "ana@example.com"', async () => {
      ({ app, db } = makeTestApp());
      adminJar = new CookieJar();
      await signInAsAdministrator(app, db, adminJar, 'ana@example.com');
    });
    And('a host "bob@example.com"', async () => {
      await registerAndLogin(app, new CookieJar(), 'bob@example.com');
    });
    When('the administrator asks to see the host accounts', async () => {
      response = await request(app, adminJar, { method: 'GET', url: '/admin/hosts' });
    });
    Then('every existing host account is listed', () => {
      expect(response.statusCode).toBe(200);
      const emails = response.json().hosts.map((host: { email: string }) => host.email);
      expect(emails).toEqual(expect.arrayContaining(['ana@example.com', 'bob@example.com']));
      expect(emails).toHaveLength(2);
    });
    And('each one shows whether it is an administrator', () => {
      const hosts: { email: string; isAdministrator: boolean }[] = response.json().hosts;
      const byEmail = new Map(hosts.map((host) => [host.email, host.isAdministrator]));
      expect(byEmail.get('ana@example.com')).toBe(true);
      expect(byEmail.get('bob@example.com')).toBe(false);
    });
  });

  Scenario('A host is refused administrative work', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a signed-in host "bob@example.com"', async () => {
      ({ app } = makeTestApp());
      jar = new CookieJar();
      await registerAndLogin(app, jar, 'bob@example.com');
    });
    When('that host asks to see the host accounts', async () => {
      response = await request(app, jar, { method: 'GET', url: '/admin/hosts' });
    });
    Then('access is refused as not allowed', () => {
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('NOT_ALLOWED');
    });
  });

  Scenario('Being refused tells the host nothing about what exists', ({ Given, And, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let hostJar: CookieJar;
    let response: LightMyRequestResponse;

    Given('an administrator "ana@example.com"', async () => {
      ({ app, db } = makeTestApp());
      await signInAsAdministrator(app, db, new CookieJar(), 'ana@example.com');
    });
    And('a signed-in host "bob@example.com"', async () => {
      hostJar = new CookieJar();
      await registerAndLogin(app, hostJar, 'bob@example.com');
    });
    When('that host asks to see the host accounts', async () => {
      response = await request(app, hostJar, { method: 'GET', url: '/admin/hosts' });
    });
    Then('the refusal reveals no host account', () => {
      expect(response.body).not.toContain('ana@example.com');
      expect(response.body).not.toContain('bob@example.com');
    });
  });

  Scenario('Administrative work is refused when no one is signed in', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('no one is signed in', () => {
      ({ app } = makeTestApp());
      jar = new CookieJar();
    });
    When('the host accounts are asked for', async () => {
      response = await request(app, jar, { method: 'GET', url: '/admin/hosts' });
    });
    Then('access is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });

  Scenario("An administrator's token cannot do administrative work", ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let token: string;
    let response: LightMyRequestResponse;

    Given('an administrator "ana@example.com" who has issued a personal access token', async () => {
      ({ app, db } = makeTestApp());
      const jar = new CookieJar();
      await signInAsAdministrator(app, db, jar, 'ana@example.com');
      const issued = await request(app, jar, { method: 'POST', url: '/auth/pats' });
      token = issued.json().token;
    });
    When('an external client uses that token to ask to see the host accounts', async () => {
      response = await requestAsExternalClient(app, token, { method: 'GET', url: '/admin/hosts' });
    });
    Then('access is refused as not allowed', () => {
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('NOT_ALLOWED');
    });
  });

  Scenario("An administrator's token can still do a host's work", ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let token: string;
    let response: LightMyRequestResponse;

    Given('an administrator "ana@example.com" who has issued a personal access token', async () => {
      ({ app, db } = makeTestApp());
      const jar = new CookieJar();
      await signInAsAdministrator(app, db, jar, 'ana@example.com');
      const issued = await request(app, jar, { method: 'POST', url: '/auth/pats' });
      token = issued.json().token;
    });
    When('an external client uses that token to create a draft', async () => {
      response = await requestAsExternalClient(app, token, {
        method: 'POST',
        url: '/drafts',
        payload: { name: 'Tapas Night' },
      });
    });
    Then('the draft is created for that administrator', () => {
      expect(response.statusCode).toBe(201);
      expect(response.json().content.name).toBe('Tapas Night');
    });
  });

  Scenario("An administrator's own app is told they are one", ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('an administrator "ana@example.com"', async () => {
      ({ app, db } = makeTestApp());
      jar = new CookieJar();
      await signInAsAdministrator(app, db, jar, 'ana@example.com');
    });
    When('their app asks who it is talking to', async () => {
      response = await request(app, jar, { method: 'GET', url: '/auth/me' });
    });
    Then('it is told they are signed in', () => {
      expect(response.statusCode).toBe(200);
      expect(response.json().hostId).toBeTruthy();
    });
    And('it is told they are an administrator', () => {
      expect(response.json().role).toBe('admin');
    });
  });

  Scenario("A host's own app is told they are not", ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a signed-in host "bob@example.com"', async () => {
      ({ app } = makeTestApp());
      jar = new CookieJar();
      await registerAndLogin(app, jar, 'bob@example.com');
    });
    When('their app asks who it is talking to', async () => {
      response = await request(app, jar, { method: 'GET', url: '/auth/me' });
    });
    Then('it is told they are signed in', () => {
      expect(response.statusCode).toBe(200);
      expect(response.json().hostId).toBeTruthy();
    });
    And('it is told they are not an administrator', () => {
      expect(response.json().role).toBe('host');
    });
  });

  Scenario('An app with nobody signed in is told so', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let response: LightMyRequestResponse;

    Given('no one is signed in', () => {
      ({ app } = makeTestApp());
    });
    When('an app asks who it is talking to', async () => {
      response = await request(app, new CookieJar(), { method: 'GET', url: '/auth/me' });
    });
    Then('it is told nobody is signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });

  Scenario('Asking records no refused administrative attempt', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let jar: CookieJar;

    Given('a signed-in host "bob@example.com"', async () => {
      ({ app, db } = makeTestApp());
      jar = new CookieJar();
      await registerAndLogin(app, jar, 'bob@example.com');
    });
    When('their app asks who it is talking to', async () => {
      const response = await request(app, jar, { method: 'GET', url: '/auth/me' });
      expect(response.statusCode).toBe(200);
    });
    Then('the security log records no refused administrative attempt', () => {
      // The whole reason this endpoint exists rather than probing /admin/* and
      // reading a 403: that would fire this record for every ordinary host on
      // every page load, and bury the one line that means somebody reached for
      // something they should not have.
      const refused = new SqliteSecurityEventLog(db, new SystemClock(), new UuidIdGenerator())
        .list()
        .find((event) => event.type === 'admin_access.refused');
      expect(refused).toBeUndefined();
    });
  });
});
