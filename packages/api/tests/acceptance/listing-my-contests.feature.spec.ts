import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp, seedHost } from '../support/test-server.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./listing-my-contests.feature', import.meta.url)),
);

const STRONG_PASSWORD = 'Str0ng!Passw0rd';

/** A complete, publishable draft: 4 people in 2 couples, per person, couples barred. */
function completeContent(name: string): DraftContent {
  const person = (id: string, partnerId: string) => ({ id, displayName: id, partnerId });
  return {
    name,
    attribution: 'per_person',
    antiBias: 'couples',
    scoring: {
      categories: [{ id: 'c1', name: 'Taste' }],
      range: { type: 'auto' },
      uniquePerCategory: true,
    },
    participants: [person('A', 'B'), person('B', 'A'), person('C', 'D'), person('D', 'C')],
  };
}

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
  options: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; url: string; payload?: object },
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

/** Saves a draft and leaves it unpublished — a contest still being prepared. */
async function prepareContest(app: FastifyInstance, jar: CookieJar, name: string): Promise<void> {
  await request(app, jar, { method: 'POST', url: '/drafts', payload: completeContent(name) });
}

/** Saves and publishes a draft, returning the live contest's id. */
async function liveContest(app: FastifyInstance, jar: CookieJar, name: string): Promise<string> {
  const created = await request(app, jar, {
    method: 'POST',
    url: '/drafts',
    payload: completeContent(name),
  });
  const published = await request(app, jar, {
    method: 'POST',
    url: `/drafts/${created.json().id}/publish`,
  });
  return published.json().id;
}

async function close(app: FastifyInstance, jar: CookieJar, id: string): Promise<void> {
  const closed = await request(app, jar, { method: 'POST', url: `/contests/${id}/close` });
  expect(closed.statusCode).toBe(200);
}

async function reveal(app: FastifyInstance, jar: CookieJar, id: string): Promise<void> {
  const revealed = await request(app, jar, { method: 'POST', url: `/contests/${id}/reveal` });
  expect(revealed.statusCode).toBe(200);
}

/** The status the list gives a contest, found by name. */
function statusOf(response: LightMyRequestResponse, name: string): string | undefined {
  return response.json().find((c: { name: string }) => c.name === name)?.status;
}

describeFeature(feature, ({ Scenario }) => {
  Scenario(
    'A host sees their contests across every state, each marked with its state',
    ({ Given, And, When, Then }) => {
      let app: FastifyInstance;
      let jar: CookieJar;
      let response: LightMyRequestResponse;

      Given('a signed-in host "ana@example.com"', async () => {
        ({ app } = makeTestApp());
        jar = await signedInHost(app, 'ana@example.com');
      });
      And('that host is preparing a contest named "Summer Tapas"', async () => {
        await prepareContest(app, jar, 'Summer Tapas');
      });
      And('that host has a live contest named "Balcony Cook-off"', async () => {
        await liveContest(app, jar, 'Balcony Cook-off');
      });
      And('that host has a contest named "Winter Feast" whose results have been revealed', async () => {
        const id = await liveContest(app, jar, 'Winter Feast');
        await close(app, jar, id);
        await reveal(app, jar, id);
      });
      When('that host lists their contests', async () => {
        response = await request(app, jar, { method: 'GET', url: '/contests' });
        expect(response.statusCode).toBe(200);
      });
      Then('all three contests are listed', () => {
        expect(response.json()).toHaveLength(3);
      });
      And('"Summer Tapas" is marked as being prepared', () => {
        expect(statusOf(response, 'Summer Tapas')).toBe('draft');
      });
      And('"Balcony Cook-off" is marked as live', () => {
        expect(statusOf(response, 'Balcony Cook-off')).toBe('live');
      });
      And('"Winter Feast" is marked as revealed', () => {
        expect(statusOf(response, 'Winter Feast')).toBe('revealed');
      });
    },
  );

  Scenario('A contest whose voting has closed is listed as closed', ({ Given, And, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a signed-in host "ana@example.com"', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
    });
    And('that host has a contest named "Rooftop Rounds" whose voting has closed', async () => {
      const id = await liveContest(app, jar, 'Rooftop Rounds');
      await close(app, jar, id);
    });
    When('that host lists their contests', async () => {
      response = await request(app, jar, { method: 'GET', url: '/contests' });
    });
    Then('"Rooftop Rounds" is marked as closed', () => {
      expect(statusOf(response, 'Rooftop Rounds')).toBe('closed');
    });
  });

  Scenario('A host with no contests yet gets an empty list', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a signed-in host "ana@example.com" with no contests', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
    });
    When('that host lists their contests', async () => {
      response = await request(app, jar, { method: 'GET', url: '/contests' });
    });
    Then('no contests are listed', () => {
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });
  });

  Scenario('A host only sees their own contests', ({ Given, And, When, Then }) => {
    let app: FastifyInstance;
    let anaJar: CookieJar;
    let response: LightMyRequestResponse;

    Given(
      'a signed-in host "ana@example.com" who is preparing a contest named "Ana\'s Tapas"',
      async () => {
        ({ app } = makeTestApp());
        anaJar = await signedInHost(app, 'ana@example.com');
        await prepareContest(app, anaJar, "Ana's Tapas");
      },
    );
    And(
      'a second signed-in host "bob@example.com" who has a live contest named "Bob\'s Cook-off"',
      async () => {
        const bobJar = await signedInHost(app, 'bob@example.com');
        await liveContest(app, bobJar, "Bob's Cook-off");
      },
    );
    When('"ana@example.com" lists their contests', async () => {
      response = await request(app, anaJar, { method: 'GET', url: '/contests' });
    });
    Then('only "Ana\'s Tapas" is listed', () => {
      const listed = response.json();
      expect(listed).toHaveLength(1);
      expect(listed[0].name).toBe("Ana's Tapas");
    });
  });

  Scenario('Listing requires being signed in', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let response: LightMyRequestResponse;

    Given('no one is signed in', () => {
      ({ app } = makeTestApp());
    });
    When('listing contests is attempted', async () => {
      response = await app.inject({ method: 'GET', url: '/contests' });
    });
    Then('the attempt is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });
});
