import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { MutableClock, makeTestApp, seedHost } from '../support/test-server.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./closing-a-contest.feature', import.meta.url)),
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

/** Ana and Bob, no couples, scored 1..5 in "Taste" — closeRule/revealStrategy are the point under test. */
function contentWith(closeRule?: DraftContent['closeRule']): DraftContent {
  return {
    name: 'Tapas',
    attribution: 'per_person',
    antiBias: 'none',
    scoring: {
      categories: [{ id: 'taste', name: 'Taste' }],
      range: { type: 'fixed', min: 1, max: 5 },
      uniquePerCategory: false,
    },
    participants: [
      { id: 'ana', displayName: 'Ana' },
      { id: 'bob', displayName: 'Bob' },
    ],
    ...(closeRule ? { closeRule } : {}),
  };
}

async function publishLiveContest(
  app: FastifyInstance,
  hostJar: CookieJar,
  closeRule?: DraftContent['closeRule'],
): Promise<string> {
  const created = await request(app, hostJar, {
    method: 'POST',
    url: '/drafts',
    payload: contentWith(closeRule),
  });
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

async function sendCompleteVote(
  app: FastifyInstance,
  contestId: string,
  voterCookie: string,
  dishId: string,
): Promise<LightMyRequestResponse> {
  await app.inject({
    method: 'POST',
    url: `/contests/${contestId}/scores`,
    headers: { cookie: voterCookie },
    payload: { dishId, categoryId: 'taste', value: 4 },
  });
  return app.inject({
    method: 'POST',
    url: `/contests/${contestId}/send-vote`,
    headers: { cookie: voterCookie },
  });
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('The host closes a contest directly', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let hostJar: CookieJar;
    let contestId: string;
    let closeResponse: LightMyRequestResponse;

    Given('a live contest whose host may close it at will', async () => {
      ({ app } = makeTestApp());
      hostJar = await signedInHost(app, 'ana@example.com');
      contestId = await publishLiveContest(app, hostJar);
    });
    When('the host closes the contest', async () => {
      closeResponse = await request(app, hostJar, {
        method: 'POST',
        url: `/contests/${contestId}/close`,
      });
    });
    Then('the contest is closed', () => {
      expect(closeResponse.statusCode).toBe(200);
      expect(closeResponse.json().status).toBe('closed');
    });
  });

  Scenario(
    'A contest closes on its own once everyone who joined has voted',
    ({ Given, When, Then }) => {
      let app: FastifyInstance;
      let hostJar: CookieJar;
      let contestId: string;
      let response: LightMyRequestResponse;

      Given(
        'a live contest that closes once everyone has sent their vote, and everyone who joined has just sent theirs',
        async () => {
          ({ app } = makeTestApp());
          hostJar = await signedInHost(app, 'ana@example.com');
          contestId = await publishLiveContest(app, hostJar, { when: 'all_sent' });
          const joinCode = await joinCodeOf(app, hostJar, contestId);
          const anaCookie = await claimCookie(app, joinCode, 'ana');
          const bobCookie = await claimCookie(app, joinCode, 'bob');
          await sendCompleteVote(app, contestId, anaCookie, 'D-bob');
          await sendCompleteVote(app, contestId, bobCookie, 'D-ana');
        },
      );
      When('anyone checks the contest afterwards', async () => {
        response = await request(app, hostJar, { method: 'GET', url: `/contests/${contestId}` });
      });
      Then('the contest is closed', () => {
        expect(response.json().status).toBe('closed');
      });
    },
  );

  Scenario(
    'A contest does not close early while someone has not yet voted',
    ({ Given, When, Then }) => {
      let app: FastifyInstance;
      let hostJar: CookieJar;
      let contestId: string;
      let response: LightMyRequestResponse;

      Given(
        'a live contest that closes once everyone has sent their vote, where one participant has not sent yet',
        async () => {
          ({ app } = makeTestApp());
          hostJar = await signedInHost(app, 'ana@example.com');
          contestId = await publishLiveContest(app, hostJar, { when: 'all_sent' });
          const joinCode = await joinCodeOf(app, hostJar, contestId);
          const anaCookie = await claimCookie(app, joinCode, 'ana');
          await claimCookie(app, joinCode, 'bob'); // Bob claims but never votes.
          await sendCompleteVote(app, contestId, anaCookie, 'D-bob');
        },
      );
      When('anyone checks the contest', async () => {
        response = await request(app, hostJar, { method: 'GET', url: `/contests/${contestId}` });
      });
      Then('the contest is still live', () => {
        expect(response.json().status).toBe('live');
      });
    },
  );

  Scenario(
    'A contest closes automatically once its scheduled time arrives',
    ({ Given, When, Then }) => {
      let app: FastifyInstance;
      let hostJar: CookieJar;
      let contestId: string;
      let response: LightMyRequestResponse;

      Given('a live contest scheduled to close at a set time, and that time has passed', async () => {
        const clock = new MutableClock('2026-07-21T09:00:00.000Z');
        ({ app } = makeTestApp(clock));
        hostJar = await signedInHost(app, 'ana@example.com');
        contestId = await publishLiveContest(app, hostJar, {
          when: 'scheduled',
          at: '2026-07-21T09:05:00.000Z',
        });
        // Stay within the host access token's 15-minute lifetime — only the
        // contest's own scheduled close is under test here, not token expiry.
        clock.advance(5 * 60 * 1000 + 1000); // past the scheduled close time
      });
      When('anyone checks the contest', async () => {
        response = await request(app, hostJar, { method: 'GET', url: `/contests/${contestId}` });
      });
      Then('the contest is closed', () => {
        expect(response.json().status).toBe('closed');
      });
    },
  );

  Scenario(
    'A closed contest refuses further dishes, scores, and votes',
    ({ Given, When, Then }) => {
      let app: FastifyInstance;
      let contestId: string;
      let voterCookie: string;
      let dishResponse: LightMyRequestResponse;
      let scoreResponse: LightMyRequestResponse;
      let voteResponse: LightMyRequestResponse;

      Given('a contest that has closed', async () => {
        ({ app } = makeTestApp());
        const hostJar = await signedInHost(app, 'ana@example.com');
        contestId = await publishLiveContest(app, hostJar);
        const joinCode = await joinCodeOf(app, hostJar, contestId);
        voterCookie = await claimCookie(app, joinCode, 'ana');
        await claimCookie(app, joinCode, 'bob');
        await request(app, hostJar, { method: 'POST', url: `/contests/${contestId}/close` });
      });
      When(
        'a participant tries to submit a dish, save a score, or send a vote',
        async () => {
          dishResponse = await app.inject({
            method: 'POST',
            url: `/contests/${contestId}/dishes`,
            headers: { cookie: voterCookie },
            payload: { name: 'Patatas bravas' },
          });
          scoreResponse = await app.inject({
            method: 'POST',
            url: `/contests/${contestId}/scores`,
            headers: { cookie: voterCookie },
            payload: { dishId: 'D-bob', categoryId: 'taste', value: 4 },
          });
          voteResponse = await app.inject({
            method: 'POST',
            url: `/contests/${contestId}/send-vote`,
            headers: { cookie: voterCookie },
          });
        },
      );
      Then('each attempt is refused because the contest is closed', () => {
        expect(dishResponse.statusCode).toBe(409);
        expect(dishResponse.json().error.code).toBe('CONTEST_CLOSED');
        expect(scoreResponse.statusCode).toBe(409);
        expect(scoreResponse.json().error.code).toBe('CONTEST_CLOSED');
        expect(voteResponse.statusCode).toBe(409);
        expect(voteResponse.json().error.code).toBe('CONTEST_CLOSED');
      });
    },
  );

  Scenario("A host cannot close another host's contest", ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let contestId: string;
    let intruderJar: CookieJar;
    let closeResponse: LightMyRequestResponse;

    Given('a live contest owned by one host', async () => {
      ({ app } = makeTestApp());
      const hostJar = await signedInHost(app, 'ana@example.com');
      contestId = await publishLiveContest(app, hostJar);
      intruderJar = await signedInHost(app, 'bob@example.com');
    });
    When("a different host tries to close it", async () => {
      closeResponse = await request(app, intruderJar, {
        method: 'POST',
        url: `/contests/${contestId}/close`,
      });
    });
    Then('closing is refused as not allowed', () => {
      expect(closeResponse.statusCode).toBe(403);
      expect(closeResponse.json().error.code).toBe('NOT_ALLOWED');
    });
  });

  Scenario('Closing an already-closed contest changes nothing', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let hostJar: CookieJar;
    let contestId: string;
    let closeResponse: LightMyRequestResponse;

    Given('a contest that has closed', async () => {
      ({ app } = makeTestApp());
      hostJar = await signedInHost(app, 'ana@example.com');
      contestId = await publishLiveContest(app, hostJar);
      await request(app, hostJar, { method: 'POST', url: `/contests/${contestId}/close` });
    });
    When('the host tries to close it again', async () => {
      closeResponse = await request(app, hostJar, {
        method: 'POST',
        url: `/contests/${contestId}/close`,
      });
    });
    Then('closing is refused because the contest is already closed', () => {
      expect(closeResponse.statusCode).toBe(409);
      expect(closeResponse.json().error.code).toBe('ALREADY_CLOSED');
    });
  });
});
