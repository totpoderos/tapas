import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp } from '../support/test-server.js';

const feature = await loadFeature(fileURLToPath(new URL('./seeing-the-results.feature', import.meta.url)));

const STRONG_PASSWORD = 'Str0ng!Passw0rd';

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

/** Ana & Bob, no couples, 1..5 Taste. */
function content(): DraftContent {
  return {
    name: 'Summer Tapas',
    attribution: 'per_person',
    antiBias: 'none',
    scoring: { categories: [{ id: 'taste', name: 'Taste' }], range: { type: 'fixed', min: 1, max: 5 }, uniquePerCategory: false },
    participants: [
      { id: 'ana', displayName: 'Ana' },
      { id: 'bob', displayName: 'Bob' },
    ],
  };
}

async function claim(app: FastifyInstance, joinCode: string, participantId: string): Promise<CookieJar> {
  const jar = new CookieJar();
  const res = await request(app, jar, { method: 'POST', url: `/contests/${joinCode}/claim`, payload: { participantId } });
  expect(res.statusCode).toBe(201);
  return jar;
}

/**
 * Publishes a contest, has Ana and Bob submit dishes and score each other (Bob's
 * dish wins), sends both votes, then optionally closes and reveals it.
 * Returns the contest id, Ana's voter jar, and the host jar.
 */
async function playContest(app: FastifyInstance, opts: { close: boolean; reveal: boolean }) {
  const host = new CookieJar();
  await request(app, host, { method: 'POST', url: '/auth/register', payload: { email: 'h@x.es', password: STRONG_PASSWORD } });
  await request(app, host, { method: 'POST', url: '/auth/login', payload: { email: 'h@x.es', password: STRONG_PASSWORD } });
  const created = await request(app, host, { method: 'POST', url: '/drafts', payload: content() });
  const published = await request(app, host, { method: 'POST', url: `/drafts/${created.json().id}/publish` });
  const contestId = published.json().id as string;
  const joinCode = published.json().joinCode as string;

  const ana = await claim(app, joinCode, 'ana');
  const bob = await claim(app, joinCode, 'bob');
  await request(app, ana, { method: 'POST', url: `/contests/${contestId}/dishes`, payload: { name: 'Patatas bravas' } });
  await request(app, bob, { method: 'POST', url: `/contests/${contestId}/dishes`, payload: { name: 'Tortilla' } });
  // Ana scores Bob's dish 5; Bob scores Ana's dish 3 — Bob's dish wins.
  await request(app, ana, { method: 'POST', url: `/contests/${contestId}/scores`, payload: { dishId: 'D-bob', categoryId: 'taste', value: 5 } });
  await request(app, ana, { method: 'POST', url: `/contests/${contestId}/send-vote` });
  await request(app, bob, { method: 'POST', url: `/contests/${contestId}/scores`, payload: { dishId: 'D-ana', categoryId: 'taste', value: 3 } });
  await request(app, bob, { method: 'POST', url: `/contests/${contestId}/send-vote` });

  if (opts.close) await request(app, host, { method: 'POST', url: `/contests/${contestId}/close` });
  if (opts.reveal) await request(app, host, { method: 'POST', url: `/contests/${contestId}/reveal` });
  return { contestId, ana };
}

interface Reveal {
  contestName: string;
  overall: { winners: { dishId: string; name: string }[]; standings: { dishId: string; name: string; total: number }[] };
  categories: { categoryId: string; name: string; winners: { dishId: string; name: string }[] }[];
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('A participant reads the winners of a revealed contest', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let ana: CookieJar;
    let contestId: string;
    let reveal: Reveal;

    Given('a contest that has been fully voted, closed, and revealed', async () => {
      ({ app } = makeTestApp());
      ({ contestId, ana } = await playContest(app, { close: true, reveal: true }));
    });
    When('a participant who took part reads the results', async () => {
      const response = await request(app, ana, { method: 'GET', url: `/contests/${contestId}/reveal` });
      expect(response.statusCode).toBe(200);
      reveal = response.json();
    });
    Then('they see the overall winner by name', () => {
      expect(reveal.overall.winners.map((w) => w.name)).toEqual(['Tortilla']);
    });
    And('they see the winner of each category', () => {
      const taste = reveal.categories.find((c) => c.categoryId === 'taste');
      expect(taste?.winners.map((w) => w.name)).toEqual(['Tortilla']);
    });
  });

  Scenario('The results are held back until the contest is revealed', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let ana: CookieJar;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given('a contest that has been fully voted and closed but not revealed', async () => {
      ({ app } = makeTestApp());
      ({ contestId, ana } = await playContest(app, { close: true, reveal: false }));
    });
    When('a participant who took part reads the results', async () => {
      response = await request(app, ana, { method: 'GET', url: `/contests/${contestId}/reveal` });
    });
    Then('they are told the results are not out yet', () => {
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('NOT_REVEALED');
    });
  });

  Scenario('Reading the results requires having claimed a place', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given('a revealed contest', async () => {
      ({ app } = makeTestApp());
      ({ contestId } = await playContest(app, { close: true, reveal: true }));
    });
    When('the results are read with no participant token', async () => {
      response = await app.inject({ method: 'GET', url: `/contests/${contestId}/reveal` });
    });
    Then('it is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });
});
