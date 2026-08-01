import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp, seedHost } from '../support/test-server.js';

const feature = await loadFeature(fileURLToPath(new URL('./reading-my-ballot.feature', import.meta.url)));

const STRONG_PASSWORD = 'Str0ng!Passw0rd';

/** Per-person, couples barred: 4 people in 2 couples. Voter A may score C and D only. */
function completeContent(name: string): DraftContent {
  const person = (id: string, partnerId: string) => ({ id, displayName: id, partnerId });
  return {
    name,
    attribution: 'per_person',
    antiBias: 'couples',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: true },
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

/** Publishes a live contest as a fresh host and returns its join code. */
async function liveContest(app: FastifyInstance): Promise<string> {
  const jar = new CookieJar();
  await seedHost(app, 'host@example.com', STRONG_PASSWORD);
  await request(app, jar, { method: 'POST', url: '/auth/login', payload: { email: 'host@example.com', password: STRONG_PASSWORD } });
  const created = await request(app, jar, { method: 'POST', url: '/drafts', payload: completeContent('Summer Tapas') });
  const published = await request(app, jar, { method: 'POST', url: `/drafts/${created.json().id}/publish` });
  return published.json().joinCode;
}

/**
 * A plain per-person contest where one cook — Bruno — never names their dish,
 * so a voter's ballot has to call it something. The couples-barred shape above
 * is the wrong seed for this: it removes half the roster from every ballot.
 */
function simpleContent(): DraftContent {
  return {
    name: 'Summer Tapas',
    attribution: 'per_person',
    antiBias: 'none',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'fixed', min: 1, max: 5 }, uniquePerCategory: false },
    participants: [
      { id: 'ana', displayName: 'Ana' },
      { id: 'bruno', displayName: 'Bruno' },
    ],
  };
}

interface Ballot {
  contestId: string;
  dishes: { dishId: string; name: string }[];
  categories: { id: string; name: string }[];
  range: { min: number; max: number };
  uniquePerCategory: boolean;
}

describeFeature(feature, ({ Scenario }) => {
  Scenario("A voter's ballot lists only the dishes open to them", ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let voter: CookieJar;
    let contestId: string;
    let ballot: Ballot;

    Given('a live contest a participant has joined, scored per person with couples barred', async () => {
      ({ app } = makeTestApp());
      const joinCode = await liveContest(app);
      voter = new CookieJar();
      const claim = await request(app, voter, {
        method: 'POST',
        url: `/contests/${joinCode}/claim`,
        payload: { participantId: 'A' },
      });
      expect(claim.statusCode).toBe(201);
      contestId = claim.json().contestId;
    });
    When('that participant reads their ballot', async () => {
      const response = await request(app, voter, { method: 'GET', url: `/contests/${contestId}/ballot` });
      expect(response.statusCode).toBe(200);
      ballot = response.json();
    });
    Then('their own dish is not on it', () => {
      expect(ballot.dishes.map((d) => d.dishId)).not.toContain('D-A');
    });
    And("their partner's dish is not on it", () => {
      expect(ballot.dishes.map((d) => d.dishId)).not.toContain('D-B');
    });
    And('the dishes they may score are on it, with the categories and their score range', () => {
      expect(ballot.dishes.map((d) => d.dishId).sort()).toEqual(['D-C', 'D-D']);
      expect(ballot.categories.map((c) => c.name)).toContain('Taste');
      expect(ballot.range).toEqual({ min: 1, max: 2 });
    });
  });

  Scenario('A dish nobody named is called by its cook on the ballot too', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let ana: CookieJar;
    let bruno: CookieJar;
    let host: CookieJar;
    let contestId: string;
    let ballot: Ballot;

    Given('a live contest where one cook never named their dish', async () => {
      ({ app } = makeTestApp());
      host = new CookieJar();
      await seedHost(app, 'ballot-unnamed@x.es', STRONG_PASSWORD);
      await request(app, host, { method: 'POST', url: '/auth/login', payload: { email: 'ballot-unnamed@x.es', password: STRONG_PASSWORD } });
      const created = await request(app, host, { method: 'POST', url: '/drafts', payload: simpleContent() });
      const published = await request(app, host, { method: 'POST', url: `/drafts/${created.json().id}/publish` });
      const joinCode = published.json().joinCode as string;
      contestId = published.json().id as string;

      ana = new CookieJar();
      await request(app, ana, { method: 'POST', url: `/contests/${joinCode}/claim`, payload: { participantId: 'ana' } });
      await request(app, ana, { method: 'POST', url: `/contests/${contestId}/dishes`, payload: { name: 'Patatas bravas' } });
      // Bruno takes his place and submits nothing.
      bruno = new CookieJar();
      await request(app, bruno, { method: 'POST', url: `/contests/${joinCode}/claim`, payload: { participantId: 'bruno' } });
    });
    When('another participant reads their ballot', async () => {
      const response = await request(app, ana, { method: 'GET', url: `/contests/${contestId}/ballot` });
      expect(response.statusCode).toBe(200);
      ballot = response.json();
    });
    Then('that dish is called by the name of the cook whose it is', () => {
      expect(ballot.dishes.find((dish) => dish.dishId === 'D-bruno')?.name).toBe('Bruno');
    });
    And('it is called the same thing when the results are revealed', async () => {
      /*
       * The promise, and the reason the ballot stopped keeping a placeholder of
       * its own: it said `A dish (not named yet)` where the reveal said `A
       * dish`, so the same dish had two names on two screens a participant
       * moves between. Both reads go through one naming function now, and this
       * is the test that would fail if either grew a second one.
       */
      for (const [jar, dishId] of [[ana, 'D-bruno'], [bruno, 'D-ana']] as const) {
        await request(app, jar, { method: 'POST', url: `/contests/${contestId}/scores`, payload: { dishId, categoryId: 'c1', value: 4 } });
        expect((await request(app, jar, { method: 'POST', url: `/contests/${contestId}/send-vote` })).statusCode).toBe(200);
      }
      await request(app, host, { method: 'POST', url: `/contests/${contestId}/close` });
      await request(app, host, { method: 'POST', url: `/contests/${contestId}/reveal` });

      const revealed = await request(app, ana, { method: 'GET', url: `/contests/${contestId}/reveal` });
      expect(revealed.statusCode).toBe(200);
      const standings = revealed.json().overall.standings as { dishId: string; name: string }[];
      expect(standings.find((standing) => standing.dishId === 'D-bruno')?.name).toBe('Bruno');
    });
  });

  Scenario('Reading a ballot requires having claimed a place', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given('a live contest', async () => {
      ({ app } = makeTestApp());
      const joinCode = await liveContest(app);
      const probe = new CookieJar();
      const claim = await request(app, probe, { method: 'POST', url: `/contests/${joinCode}/claim`, payload: { participantId: 'C' } });
      contestId = claim.json().contestId;
    });
    When('a ballot is requested with no participant token', async () => {
      response = await app.inject({ method: 'GET', url: `/contests/${contestId}/ballot` });
    });
    Then('it is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });
});
