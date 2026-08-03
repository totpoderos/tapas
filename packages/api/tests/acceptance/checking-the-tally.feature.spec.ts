import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp, seedHost } from '../support/test-server.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./checking-the-tally.feature', import.meta.url)),
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

/** Ana, Bob, and Carol, no couples, scored 1..5 in "Taste". */
function content(): DraftContent {
  return {
    name: 'Tapas',
    format: 'solo',
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
}

async function publishLiveContest(app: FastifyInstance, hostJar: CookieJar): Promise<string> {
  const created = await request(app, hostJar, { method: 'POST', url: '/drafts', payload: content() });
  const published = await request(app, hostJar, {
    method: 'POST',
    url: `/drafts/${created.json().id}/publish`,
  });
  return published.json().id;
}

async function claimCookie(app: FastifyInstance, joinCode: string, participantId: string): Promise<string> {
  const claim = await app.inject({
    method: 'POST',
    url: `/contests/${joinCode}/claim`,
    payload: { participantId },
  });
  const cookie = claim.cookies.find((raw) => raw.name === 'voter_token');
  if (!cookie) throw new Error(`expected a claim to succeed: ${JSON.stringify(claim.json())}`);
  return `voter_token=${cookie.value}`;
}

async function joinCodeOf(app: FastifyInstance, hostJar: CookieJar, contestId: string): Promise<string> {
  const contest = await request(app, hostJar, { method: 'GET', url: `/contests/${contestId}` });
  return contest.json().joinCode;
}

async function score(
  app: FastifyInstance,
  contestId: string,
  voterCookie: string,
  dishId: string,
): Promise<void> {
  await app.inject({
    method: 'POST',
    url: `/contests/${contestId}/scores`,
    headers: { cookie: voterCookie },
    payload: { dishId, categoryId: 'taste', value: 4 },
  });
}

async function sendVote(app: FastifyInstance, contestId: string, voterCookie: string): Promise<void> {
  await app.inject({
    method: 'POST',
    url: `/contests/${contestId}/send-vote`,
    headers: { cookie: voterCookie },
  });
}

describeFeature(feature, ({ Scenario }) => {
  Scenario(
    'A contest nobody has joined still says how many places there are',
    ({ Given, When, Then }) => {
      let app: FastifyInstance;
      let hostJar: CookieJar;
      let contestId: string;
      let response: LightMyRequestResponse;

      Given('a contest nobody has claimed a place in', async () => {
        ({ app } = await makeTestApp());
        hostJar = await signedInHost(app, 'ana@example.com');
        contestId = await publishLiveContest(app, hostJar);
      });
      When('the host checks the tally', async () => {
        response = await request(app, hostJar, {
          method: 'GET',
          url: `/contests/${contestId}/tally`,
        });
      });
      Then('the tally says how many places there are, and that none are claimed', () => {
        expect(response.statusCode).toBe(200);
        // Three places on the roster and nobody in them. "None of three" — not a
        // bare nought, which says nothing about whether anyone was expected.
        expect(response.json()).toEqual({
          placeCount: 3,
          claimedCount: 0,
          draftCount: 0,
          sentCount: 0,
        });
      });
    },
  );

  Scenario('The host checks the tally of a contest in progress', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let hostJar: CookieJar;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given(
      'a contest where some participants have claimed a place, some have drafted scores, and one has sent a vote',
      async () => {
        ({ app } = await makeTestApp());
        hostJar = await signedInHost(app, 'ana@example.com');
        contestId = await publishLiveContest(app, hostJar);
        const joinCode = await joinCodeOf(app, hostJar, contestId);

        const anaCookie = await claimCookie(app, joinCode, 'ana');
        const bobCookie = await claimCookie(app, joinCode, 'bob');
        await claimCookie(app, joinCode, 'carol'); // claims but never scores.

        await score(app, contestId, anaCookie, 'D-bob'); // draft: never sent.

        await score(app, contestId, bobCookie, 'D-ana');
        await score(app, contestId, bobCookie, 'D-carol');
        await sendVote(app, contestId, bobCookie);
      },
    );
    When('the host checks the tally', async () => {
      response = await request(app, hostJar, { method: 'GET', url: `/contests/${contestId}/tally` });
    });
    Then(
      'the tally shows how many have claimed, how many are still drafting, and how many have sent',
      () => {
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
          placeCount: 3,
          claimedCount: 3,
          draftCount: 1,
          sentCount: 1,
        });
      },
    );
    And('it says how many places there are in total', () => {
      expect(response.json().placeCount).toBe(3);
    });
  });

  Scenario("A host cannot check another host's tally", ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let contestId: string;
    let intruderJar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a contest owned by one host', async () => {
      ({ app } = await makeTestApp());
      const hostJar = await signedInHost(app, 'ana@example.com');
      contestId = await publishLiveContest(app, hostJar);
      intruderJar = await signedInHost(app, 'bob@example.com');
    });
    When("a different host tries to check its tally", async () => {
      response = await request(app, intruderJar, {
        method: 'GET',
        url: `/contests/${contestId}/tally`,
      });
    });
    Then('checking is refused as not allowed', () => {
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('NOT_ALLOWED');
    });
  });
});
