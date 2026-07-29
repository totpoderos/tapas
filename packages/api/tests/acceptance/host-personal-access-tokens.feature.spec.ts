import { fileURLToPath } from 'node:url';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp, seedHost } from '../support/test-server.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./host-personal-access-tokens.feature', import.meta.url)),
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

describeFeature(feature, ({ Scenario }) => {
  Scenario('A signed-in host issues a personal access token', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a signed-in host "ana@example.com"', async () => {
      ({ app } = makeTestApp());
      jar = new CookieJar();
      await registerAndLogin(app, jar, 'ana@example.com');
    });
    When('that host issues a personal access token', async () => {
      response = await request(app, jar, { method: 'POST', url: '/auth/pats' });
    });
    Then('a usable token is returned', () => {
      expect(response.statusCode).toBe(201);
      expect(response.json().token).toBeTruthy();
    });
  });

  Scenario('The token lets an external client act as that host', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let token: string;
    let response: LightMyRequestResponse;

    Given('a signed-in host "ana@example.com" who has issued a personal access token', async () => {
      ({ app } = makeTestApp());
      jar = new CookieJar();
      await registerAndLogin(app, jar, 'ana@example.com');
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
    Then('the draft is created for that host', () => {
      expect(response.statusCode).toBe(201);
      expect(response.json().content.name).toBe('Tapas Night');
    });
  });

  Scenario('A revoked token no longer works', ({ Given, When, And, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let token: string;
    let patId: string;
    let response: LightMyRequestResponse;

    Given('a signed-in host "ana@example.com" who has issued a personal access token', async () => {
      ({ app } = makeTestApp());
      jar = new CookieJar();
      await registerAndLogin(app, jar, 'ana@example.com');
      const issued = await request(app, jar, { method: 'POST', url: '/auth/pats' });
      token = issued.json().token;
      patId = issued.json().id;
    });
    When('the host revokes that token', async () => {
      const revoked = await request(app, jar, { method: 'DELETE', url: `/auth/pats/${patId}` });
      expect(revoked.statusCode).toBe(200);
    });
    And('an external client tries to use the revoked token', async () => {
      response = await requestAsExternalClient(app, token, {
        method: 'POST',
        url: '/drafts',
        payload: { name: 'Tapas Night' },
      });
    });
    Then('access is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });

  Scenario("A host cannot revoke another host's token", ({ Given, And, When, Then }) => {
    let app: FastifyInstance;
    let anaJar: CookieJar;
    let bobJar: CookieJar;
    let patId: string;
    let response: LightMyRequestResponse;

    Given('a signed-in host "ana@example.com" who has issued a personal access token', async () => {
      ({ app } = makeTestApp());
      anaJar = new CookieJar();
      await registerAndLogin(app, anaJar, 'ana@example.com');
      const issued = await request(app, anaJar, { method: 'POST', url: '/auth/pats' });
      patId = issued.json().id;
    });
    And('a second signed-in host "bob@example.com"', async () => {
      bobJar = new CookieJar();
      await registerAndLogin(app, bobJar, 'bob@example.com');
    });
    When('"bob@example.com" tries to revoke ana\'s token', async () => {
      response = await request(app, bobJar, { method: 'DELETE', url: `/auth/pats/${patId}` });
    });
    Then('access is refused as not allowed', () => {
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('NOT_ALLOWED');
    });
  });

  Scenario('Issuing a token requires being signed in', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('no one is signed in', () => {
      ({ app } = makeTestApp());
      jar = new CookieJar();
    });
    When('someone tries to issue a personal access token', async () => {
      response = await request(app, jar, { method: 'POST', url: '/auth/pats' });
    });
    Then('access is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });
});
