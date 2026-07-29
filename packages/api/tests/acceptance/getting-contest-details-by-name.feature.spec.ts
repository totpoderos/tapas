import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp, seedHost } from '../support/test-server.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./getting-contest-details-by-name.feature', import.meta.url)),
);

const STRONG_PASSWORD = 'Str0ng!Passw0rd';

/** A draft with two named participants (Ana, Bob) and a "Taste" category. */
function draftContent(name: string): DraftContent {
  return {
    name,
    attribution: 'per_person',
    antiBias: 'none',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'fixed', min: 1, max: 5 }, uniquePerCategory: false },
    participants: [
      { id: 'a', displayName: 'Ana' },
      { id: 'b', displayName: 'Bob' },
    ],
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

async function req(app: FastifyInstance, jar: CookieJar, o: { method: 'GET' | 'POST'; url: string; payload?: object }) {
  const response = await app.inject({ ...o, headers: { cookie: jar.header() } });
  jar.capture(response);
  return response;
}

async function signedInHost(app: FastifyInstance, email: string): Promise<CookieJar> {
  const jar = new CookieJar();
  await seedHost(app, email, STRONG_PASSWORD);
  await req(app, jar, { method: 'POST', url: '/auth/login', payload: { email, password: STRONG_PASSWORD } });
  return jar;
}

async function saveDraft(app: FastifyInstance, jar: CookieJar, name: string): Promise<string> {
  const created = await req(app, jar, { method: 'POST', url: '/drafts', payload: draftContent(name) });
  return created.json().id as string;
}

async function liveContest(app: FastifyInstance, jar: CookieJar, name: string): Promise<void> {
  await req(app, jar, { method: 'POST', url: `/drafts/${await saveDraft(app, jar, name)}/publish` });
}

function details(app: FastifyInstance, jar: CookieJar, name: string) {
  return req(app, jar, { method: 'GET', url: `/contests/details?name=${encodeURIComponent(name)}` });
}

describeFeature(feature, ({ Scenario }) => {
  Scenario("A host reads the details of their draft by name", ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a host preparing a draft named "Tapas Night" with Ana and Bob taking part and a "Taste" category', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      await saveDraft(app, jar, 'Tapas Night');
    });
    When('the host asks for the details of "Tapas Night"', async () => {
      response = await details(app, jar, 'Tapas Night');
    });
    Then('the details name Ana and Bob as taking part', () => {
      expect(response.statusCode).toBe(200);
      expect(response.json().details.participants).toEqual(['Ana', 'Bob']);
    });
    And('the details name "Taste" as a scoring category', () => {
      expect(response.json().details.categories).toEqual(['Taste']);
    });
  });

  Scenario("A host reads the details of their live contest by name", ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a host with a live contest named "Balcony Cook-off" with Ana and Bob taking part', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      await liveContest(app, jar, 'Balcony Cook-off');
    });
    When('the host asks for the details of "Balcony Cook-off"', async () => {
      response = await details(app, jar, 'Balcony Cook-off');
    });
    Then('the details name Ana and Bob as taking part', () => {
      expect(response.json().details.participants).toEqual(['Ana', 'Bob']);
    });
  });

  Scenario('Reading details by name ignores capitalisation', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a host preparing a draft named "Tapas Night" with Ana and Bob taking part and a "Taste" category', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      await saveDraft(app, jar, 'Tapas Night');
    });
    When('the host asks for the details of "tapas night"', async () => {
      response = await details(app, jar, 'tapas night');
    });
    Then('the details name Ana and Bob as taking part', () => {
      expect(response.json().details.participants).toEqual(['Ana', 'Bob']);
    });
  });

  Scenario('When two contests share a name, the host is offered the choice', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a host with two contests both named "Tapas Night"', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      await liveContest(app, jar, 'Tapas Night');
      await saveDraft(app, jar, 'Tapas Night');
    });
    When('the host asks for the details of "Tapas Night"', async () => {
      response = await details(app, jar, 'Tapas Night');
    });
    Then('the host is offered both contests to choose from', () => {
      const body = response.json();
      expect(body.details).toBeUndefined();
      expect(body.candidates).toHaveLength(2);
    });
  });

  Scenario('Asking for details of a name that matches nothing finds nothing', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a host preparing a draft named "Tapas Night" with Ana and Bob taking part and a "Taste" category', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      await saveDraft(app, jar, 'Tapas Night');
    });
    When('the host asks for the details of "Paella Sunday"', async () => {
      response = await details(app, jar, 'Paella Sunday');
    });
    Then('no contest is found', () => {
      expect(response.statusCode).toBe(200);
      expect(response.json().details).toBeUndefined();
      expect(response.json().candidates).toEqual([]);
    });
  });

  Scenario("A host cannot read another host's contest details by name", ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let anaJar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a host, and a second host with a contest named "Tapas Night"', async () => {
      ({ app } = makeTestApp());
      anaJar = await signedInHost(app, 'ana@example.com');
      const bobJar = await signedInHost(app, 'bob@example.com');
      await liveContest(app, bobJar, 'Tapas Night');
    });
    When('the first host asks for the details of "Tapas Night"', async () => {
      response = await details(app, anaJar, 'Tapas Night');
    });
    Then('no contest is found', () => {
      expect(response.json().candidates).toEqual([]);
    });
  });

  Scenario('Reading details by name requires being signed in', ({ When, Then }) => {
    let app: FastifyInstance;
    let response: LightMyRequestResponse;

    When('someone not signed in asks for the details of "Tapas Night"', async () => {
      ({ app } = makeTestApp());
      response = await app.inject({ method: 'GET', url: '/contests/details?name=Tapas%20Night' });
    });
    Then('the request is refused as not authorized', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });
});
