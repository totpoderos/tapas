import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp } from '../support/test-server.js';

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
  await request(app, jar, { method: 'POST', url: '/auth/register', payload: { email: 'host@example.com', password: STRONG_PASSWORD } });
  await request(app, jar, { method: 'POST', url: '/auth/login', payload: { email: 'host@example.com', password: STRONG_PASSWORD } });
  const created = await request(app, jar, { method: 'POST', url: '/drafts', payload: completeContent('Summer Tapas') });
  const published = await request(app, jar, { method: 'POST', url: `/drafts/${created.json().id}/publish` });
  return published.json().joinCode;
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
