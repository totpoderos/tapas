import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { MutableClock, makeTestApp, seedHost } from '../support/test-server.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./revealing-results.feature', import.meta.url)),
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

/** Ana and Bob, no couples, scored 1..5 in "Taste". */
function contentWith(revealStrategy?: DraftContent['revealStrategy']): DraftContent {
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
    ],
    ...(revealStrategy ? { revealStrategy } : {}),
  };
}

async function publishLiveContest(
  app: FastifyInstance,
  hostJar: CookieJar,
  revealStrategy?: DraftContent['revealStrategy'],
): Promise<string> {
  const created = await request(app, hostJar, {
    method: 'POST',
    url: '/drafts',
    payload: contentWith(revealStrategy),
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

async function scoreAndMaybeSend(
  app: FastifyInstance,
  contestId: string,
  voterCookie: string,
  dishId: string,
  value: number,
  send: boolean,
): Promise<void> {
  await app.inject({
    method: 'POST',
    url: `/contests/${contestId}/scores`,
    headers: { cookie: voterCookie },
    payload: { dishId, categoryId: 'taste', value },
  });
  if (send) {
    await app.inject({
      method: 'POST',
      url: `/contests/${contestId}/send-vote`,
      headers: { cookie: voterCookie },
    });
  }
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('The host reveals results for a closed contest', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let hostJar: CookieJar;
    let contestId: string;
    let revealResponse: LightMyRequestResponse;

    Given('a closed contest where every judge has sent a vote', async () => {
      ({ app } = await makeTestApp());
      hostJar = await signedInHost(app, 'ana@example.com');
      contestId = await publishLiveContest(app, hostJar);
      const joinCode = await joinCodeOf(app, hostJar, contestId);
      const anaCookie = await claimCookie(app, joinCode, 'ana');
      const bobCookie = await claimCookie(app, joinCode, 'bob');
      await scoreAndMaybeSend(app, contestId, anaCookie, 'D-bob', 4, true);
      await scoreAndMaybeSend(app, contestId, bobCookie, 'D-ana', 3, true);
      await request(app, hostJar, { method: 'POST', url: `/contests/${contestId}/close` });
    });
    When('the host reveals it', async () => {
      revealResponse = await request(app, hostJar, {
        method: 'POST',
        url: `/contests/${contestId}/reveal`,
      });
    });
    Then('the results show a winner in every category and an overall winner', async () => {
      expect(revealResponse.statusCode).toBe(200);
      const results = await request(app, hostJar, {
        method: 'GET',
        url: `/contests/${contestId}/results`,
      });
      expect(results.statusCode).toBe(200);
      const taste = results.json().categories.find((c: { categoryId: string }) => c.categoryId === 'taste');
      expect(taste.winners).toEqual(['D-bob']);
      expect(results.json().overallWinners).toEqual(['D-bob']);
    });
  });

  Scenario('A tie is shown as joint winners', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let hostJar: CookieJar;
    let contestId: string;
    let resultsResponse: LightMyRequestResponse;

    Given('a closed contest where two dishes are tied for the top score in a category', async () => {
      ({ app } = await makeTestApp());
      hostJar = await signedInHost(app, 'ana@example.com');
      contestId = await publishLiveContest(app, hostJar);
      const joinCode = await joinCodeOf(app, hostJar, contestId);
      const anaCookie = await claimCookie(app, joinCode, 'ana');
      const bobCookie = await claimCookie(app, joinCode, 'bob');
      await scoreAndMaybeSend(app, contestId, anaCookie, 'D-bob', 4, true);
      await scoreAndMaybeSend(app, contestId, bobCookie, 'D-ana', 4, true);
      await request(app, hostJar, { method: 'POST', url: `/contests/${contestId}/close` });
      await request(app, hostJar, { method: 'POST', url: `/contests/${contestId}/reveal` });
    });
    When('the host reveals it', async () => {
      resultsResponse = await request(app, hostJar, {
        method: 'GET',
        url: `/contests/${contestId}/results`,
      });
    });
    Then('both tied dishes are listed as winners of that category', () => {
      const taste = resultsResponse
        .json()
        .categories.find((c: { categoryId: string }) => c.categoryId === 'taste');
      expect([...taste.winners].sort()).toEqual(['D-ana', 'D-bob']);
    });
  });

  Scenario('An unsent vote does not count toward the results', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let hostJar: CookieJar;
    let contestId: string;
    let resultsResponse: LightMyRequestResponse;

    Given('a closed contest where one judge never sent their vote', async () => {
      ({ app } = await makeTestApp());
      hostJar = await signedInHost(app, 'ana@example.com');
      contestId = await publishLiveContest(app, hostJar);
      const joinCode = await joinCodeOf(app, hostJar, contestId);
      const anaCookie = await claimCookie(app, joinCode, 'ana');
      const bobCookie = await claimCookie(app, joinCode, 'bob');
      await scoreAndMaybeSend(app, contestId, anaCookie, 'D-bob', 4, true);
      await scoreAndMaybeSend(app, contestId, bobCookie, 'D-ana', 5, false); // Bob never sends.
      await request(app, hostJar, { method: 'POST', url: `/contests/${contestId}/close` });
      await request(app, hostJar, { method: 'POST', url: `/contests/${contestId}/reveal` });
    });
    When('the host reveals it', async () => {
      resultsResponse = await request(app, hostJar, {
        method: 'GET',
        url: `/contests/${contestId}/results`,
      });
    });
    Then("that judge's scores are not reflected in the results", () => {
      const taste = resultsResponse
        .json()
        .categories.find((c: { categoryId: string }) => c.categoryId === 'taste');
      expect(taste.totals['D-ana']).toBe(0);
      expect(taste.totals['D-bob']).toBe(4);
    });
  });

  Scenario('Reveal is refused before the contest has closed', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let hostJar: CookieJar;
    let contestId: string;
    let revealResponse: LightMyRequestResponse;

    Given('a live contest that has not yet closed', async () => {
      ({ app } = await makeTestApp());
      hostJar = await signedInHost(app, 'ana@example.com');
      contestId = await publishLiveContest(app, hostJar);
    });
    When('the host tries to reveal it', async () => {
      revealResponse = await request(app, hostJar, {
        method: 'POST',
        url: `/contests/${contestId}/reveal`,
      });
    });
    Then('reveal is refused because the contest has not closed', () => {
      expect(revealResponse.statusCode).toBe(409);
      expect(revealResponse.json().error.code).toBe('NOT_CLOSED');
    });
  });

  Scenario('Reveal cannot happen twice', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let hostJar: CookieJar;
    let contestId: string;
    let revealResponse: LightMyRequestResponse;

    Given('a contest that has already been revealed', async () => {
      ({ app } = await makeTestApp());
      hostJar = await signedInHost(app, 'ana@example.com');
      contestId = await publishLiveContest(app, hostJar);
      await request(app, hostJar, { method: 'POST', url: `/contests/${contestId}/close` });
      await request(app, hostJar, { method: 'POST', url: `/contests/${contestId}/reveal` });
    });
    When('the host tries to reveal it again', async () => {
      revealResponse = await request(app, hostJar, {
        method: 'POST',
        url: `/contests/${contestId}/reveal`,
      });
    });
    Then('reveal is refused because it has already been revealed', () => {
      expect(revealResponse.statusCode).toBe(409);
      expect(revealResponse.json().error.code).toBe('ALREADY_REVEALED');
    });
  });

  Scenario('Results are hidden until reveal', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let hostJar: CookieJar;
    let contestId: string;
    let resultsResponse: LightMyRequestResponse;

    Given('a closed contest that has not yet been revealed', async () => {
      ({ app } = await makeTestApp());
      hostJar = await signedInHost(app, 'ana@example.com');
      contestId = await publishLiveContest(app, hostJar);
      await request(app, hostJar, { method: 'POST', url: `/contests/${contestId}/close` });
    });
    When('the host asks for the results', async () => {
      resultsResponse = await request(app, hostJar, {
        method: 'GET',
        url: `/contests/${contestId}/results`,
      });
    });
    Then('the results are refused because the contest has not been revealed', () => {
      expect(resultsResponse.statusCode).toBe(409);
      expect(resultsResponse.json().error.code).toBe('NOT_REVEALED');
    });
  });

  Scenario("A host cannot reveal another host's contest", ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let contestId: string;
    let intruderJar: CookieJar;
    let revealResponse: LightMyRequestResponse;

    Given('a closed contest owned by one host', async () => {
      ({ app } = await makeTestApp());
      const hostJar = await signedInHost(app, 'ana@example.com');
      contestId = await publishLiveContest(app, hostJar);
      await request(app, hostJar, { method: 'POST', url: `/contests/${contestId}/close` });
      intruderJar = await signedInHost(app, 'bob@example.com');
    });
    When("a different host tries to reveal it", async () => {
      revealResponse = await request(app, intruderJar, {
        method: 'POST',
        url: `/contests/${contestId}/reveal`,
      });
    });
    Then('reveal is refused as not allowed', () => {
      expect(revealResponse.statusCode).toBe(403);
      expect(revealResponse.json().error.code).toBe('NOT_ALLOWED');
    });
  });

  Scenario(
    'A contest reveals automatically once its scheduled reveal time arrives',
    ({ Given, When, Then }) => {
      let app: FastifyInstance;
      let hostJar: CookieJar;
      let contestId: string;
      let response: LightMyRequestResponse;

      Given(
        'a closed contest scheduled to reveal at a set time, and that time has passed',
        async () => {
          const clock = new MutableClock('2026-07-21T09:00:00.000Z');
          ({ app } = await makeTestApp(clock));
          hostJar = await signedInHost(app, 'ana@example.com');
          contestId = await publishLiveContest(app, hostJar, {
            when: 'scheduled',
            at: '2026-07-21T09:05:00.000Z',
          });
          await request(app, hostJar, { method: 'POST', url: `/contests/${contestId}/close` });
          // Stay within the host access token's 15-minute lifetime — only the
          // contest's own scheduled reveal is under test here, not token expiry.
          clock.advance(5 * 60 * 1000 + 1000); // past the scheduled reveal time
        },
      );
      When('anyone checks the contest afterwards', async () => {
        response = await request(app, hostJar, { method: 'GET', url: `/contests/${contestId}` });
      });
      Then('the contest is revealed', () => {
        expect(response.json().status).toBe('revealed');
      });
    },
  );
});
