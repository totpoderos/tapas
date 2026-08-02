import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp, seedHost } from '../support/test-server.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./finding-a-contest-by-name.feature', import.meta.url)),
);

const STRONG_PASSWORD = 'Str0ng!Passw0rd';

/** A complete, publishable draft with the given name. */
function completeContent(name: string): DraftContent {
  const person = (id: string, partnerId: string) => ({ id, displayName: id, partnerId });
  return {
    name,
    format: 'solo_with_partners',
    scoring: {
      categories: [{ id: 'c1', name: 'Taste' }],
      range: { type: 'auto' },
      uniquePerCategory: true,
    },
    participants: [person('A', 'B'), person('B', 'A'), person('C', 'D'), person('D', 'C')],
  };
}

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
  options: { method: 'GET' | 'POST'; url: string; payload?: object },
): Promise<LightMyRequestResponse> {
  const response = await app.inject({ ...options, headers: { cookie: jar.header() } });
  jar.capture(response);
  return response;
}

async function signedInHost(app: FastifyInstance, email: string): Promise<CookieJar> {
  const jar = new CookieJar();
  await seedHost(app, email, STRONG_PASSWORD);
  await request(app, jar, {
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: STRONG_PASSWORD },
  });
  return jar;
}

/** Saves and publishes a draft named `name`, giving the host a live contest by that name. */
async function liveContest(app: FastifyInstance, jar: CookieJar, name: string): Promise<void> {
  const created = await request(app, jar, {
    method: 'POST',
    url: '/drafts',
    payload: completeContent(name),
  });
  await request(app, jar, { method: 'POST', url: `/drafts/${created.json().id}/publish` });
}

function findByName(app: FastifyInstance, jar: CookieJar, name: string): Promise<LightMyRequestResponse> {
  return request(app, jar, { method: 'GET', url: `/contests?name=${encodeURIComponent(name)}` });
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('A host finds their contest by its name', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a host with a contest named "Tapas Night"', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      await liveContest(app, jar, 'Tapas Night');
    });
    When('the host looks for a contest named "Tapas Night"', async () => {
      response = await findByName(app, jar, 'Tapas Night');
    });
    Then('the contest named "Tapas Night" is found', () => {
      expect(response.statusCode).toBe(200);
      const found = response.json();
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('Tapas Night');
    });
  });

  Scenario('Finding a contest by name ignores capitalisation', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a host with a contest named "Tapas Night"', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      await liveContest(app, jar, 'Tapas Night');
    });
    When('the host looks for a contest named "tapas night"', async () => {
      response = await findByName(app, jar, 'tapas night');
    });
    Then('the contest named "Tapas Night" is found', () => {
      const found = response.json();
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('Tapas Night');
    });
  });

  Scenario('When two contests share a name, both are offered', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a host with two contests both named "Tapas Night"', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      await liveContest(app, jar, 'Tapas Night');
      await liveContest(app, jar, 'Tapas Night');
    });
    When('the host looks for a contest named "Tapas Night"', async () => {
      response = await findByName(app, jar, 'Tapas Night');
    });
    Then('both contests named "Tapas Night" are offered', () => {
      const found = response.json();
      expect(found).toHaveLength(2);
      expect(found.every((c: { name: string }) => c.name === 'Tapas Night')).toBe(true);
    });
  });

  Scenario('A name that matches nothing finds nothing', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a host with a contest named "Tapas Night"', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      await liveContest(app, jar, 'Tapas Night');
    });
    When('the host looks for a contest named "Paella Sunday"', async () => {
      response = await findByName(app, jar, 'Paella Sunday');
    });
    Then('no contest is found', () => {
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });
  });

  Scenario("A host cannot find another host's contest by name", ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let anaJar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a host, and a second host with a contest named "Tapas Night"', async () => {
      ({ app } = makeTestApp());
      anaJar = await signedInHost(app, 'ana@example.com');
      const bobJar = await signedInHost(app, 'bob@example.com');
      await liveContest(app, bobJar, 'Tapas Night');
    });
    When('the first host looks for a contest named "Tapas Night"', async () => {
      response = await findByName(app, anaJar, 'Tapas Night');
    });
    Then('no contest is found', () => {
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });
  });

  Scenario('Finding a contest by name requires being signed in', ({ When, Then }) => {
    let app: FastifyInstance;
    let response: LightMyRequestResponse;

    When('someone not signed in looks for a contest named "Tapas Night"', async () => {
      ({ app } = makeTestApp());
      response = await app.inject({ method: 'GET', url: '/contests?name=Tapas%20Night' });
    });
    Then('the request is refused as not authorized', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });
});
