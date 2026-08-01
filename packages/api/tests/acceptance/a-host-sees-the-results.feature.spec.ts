import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp, seedHost } from '../support/test-server.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./a-host-sees-the-results.feature', import.meta.url)),
);

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
    scoring: {
      categories: [{ id: 'taste', name: 'Taste' }],
      range: { type: 'fixed', min: 1, max: 5 },
      uniquePerCategory: false,
    },
    participants: [
      { id: 'ana', displayName: 'Ana' },
      { id: 'bob', displayName: 'Bob' },
    ],
  };
}

async function signIn(app: FastifyInstance, email: string): Promise<CookieJar> {
  const jar = new CookieJar();
  await seedHost(app, email, STRONG_PASSWORD);
  await request(app, jar, {
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: STRONG_PASSWORD },
  });
  return jar;
}

async function claim(
  app: FastifyInstance,
  joinCode: string,
  participantId: string,
): Promise<CookieJar> {
  const jar = new CookieJar();
  const res = await request(app, jar, {
    method: 'POST',
    url: `/contests/${joinCode}/claim`,
    payload: { participantId },
  });
  expect(res.statusCode).toBe(201);
  return jar;
}

interface PlayOptions {
  readonly close: boolean;
  readonly reveal: boolean;
  /** Bob's score for Ana's dish. 3 leaves Bob's Tortilla ahead; 5 makes it a tie. */
  readonly bobScoresAna?: number;
  readonly hostEmail?: string;
}

/**
 * Publishes a contest, has Ana and Bob submit dishes and score each other, sends
 * both votes, then optionally closes and reveals it. By default Bob's dish wins;
 * pass `bobScoresAna: 5` to leave the two level at the top.
 */
async function playContest(app: FastifyInstance, opts: PlayOptions) {
  const host = await signIn(app, opts.hostEmail ?? 'h@x.es');
  const created = await request(app, host, { method: 'POST', url: '/drafts', payload: content() });
  const published = await request(app, host, {
    method: 'POST',
    url: `/drafts/${created.json().id}/publish`,
  });
  const contestId = published.json().id as string;
  const joinCode = published.json().joinCode as string;

  const ana = await claim(app, joinCode, 'ana');
  const bob = await claim(app, joinCode, 'bob');
  await request(app, ana, {
    method: 'POST',
    url: `/contests/${contestId}/dishes`,
    payload: { name: 'Patatas bravas' },
  });
  await request(app, bob, {
    method: 'POST',
    url: `/contests/${contestId}/dishes`,
    payload: { name: 'Tortilla' },
  });
  await request(app, ana, {
    method: 'POST',
    url: `/contests/${contestId}/scores`,
    payload: { dishId: 'D-bob', categoryId: 'taste', value: 5 },
  });
  await request(app, ana, { method: 'POST', url: `/contests/${contestId}/send-vote` });
  await request(app, bob, {
    method: 'POST',
    url: `/contests/${contestId}/scores`,
    payload: { dishId: 'D-ana', categoryId: 'taste', value: opts.bobScoresAna ?? 3 },
  });
  await request(app, bob, { method: 'POST', url: `/contests/${contestId}/send-vote` });

  if (opts.close) await request(app, host, { method: 'POST', url: `/contests/${contestId}/close` });
  if (opts.reveal) await request(app, host, { method: 'POST', url: `/contests/${contestId}/reveal` });
  return { contestId, host, ana };
}

/**
 * The same contest, except Bob never names his dish. Both dishes are still
 * scored and both reach the leaderboards, so both screens have to call Bob's
 * something — and they have to call it the same thing.
 */
async function contestWithAnUnnamedDish(app: FastifyInstance) {
  const host = await signIn(app, 'both-unnamed@x.es');
  const created = await request(app, host, { method: 'POST', url: '/drafts', payload: content() });
  const published = await request(app, host, { method: 'POST', url: `/drafts/${created.json().id}/publish` });
  const contestId = published.json().id as string;
  const joinCode = published.json().joinCode as string;

  const ana = await claim(app, joinCode, 'ana');
  const bob = await claim(app, joinCode, 'bob');
  await request(app, ana, { method: 'POST', url: `/contests/${contestId}/dishes`, payload: { name: 'Patatas bravas' } });
  // Bob submits nothing; his dish slot exists from the roster regardless.
  for (const [jar, dishId] of [[ana, 'D-bob'], [bob, 'D-ana']] as const) {
    await request(app, jar, { method: 'POST', url: `/contests/${contestId}/scores`, payload: { dishId, categoryId: 'taste', value: 4 } });
    await request(app, jar, { method: 'POST', url: `/contests/${contestId}/send-vote` });
  }
  await request(app, host, { method: 'POST', url: `/contests/${contestId}/close` });
  await request(app, host, { method: 'POST', url: `/contests/${contestId}/reveal` });
  return { contestId, host, ana };
}

interface Standing {
  dishId: string;
  name: string;
  total: number;
}
interface Winner {
  dishId: string;
  name: string;
}
interface Reveal {
  contestName: string;
  overall: { winners: Winner[]; standings: Standing[] };
  categories: { categoryId: string; name: string; winners: Winner[]; standings: Standing[] }[];
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('A host reads the winners of their revealed contest', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let host: CookieJar;
    let contestId: string;
    let reveal: Reveal;

    Given('a contest that has been fully voted, closed, and revealed', async () => {
      ({ app } = makeTestApp());
      ({ contestId, host } = await playContest(app, { close: true, reveal: true }));
    });
    When('its host reads the results', async () => {
      const response = await request(app, host, {
        method: 'GET',
        url: `/contests/${contestId}/winners`,
      });
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
    And("they see every dish's total", () => {
      expect(reveal.overall.standings).toEqual([
        { dishId: 'D-bob', name: 'Tortilla', total: 5 },
        { dishId: 'D-ana', name: 'Patatas bravas', total: 3 },
      ]);
    });
  });

  Scenario('A tie is shown as joint winners', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let host: CookieJar;
    let contestId: string;
    let reveal: Reveal;

    Given('a revealed contest in which two dishes finished level at the top', async () => {
      ({ app } = makeTestApp());
      ({ contestId, host } = await playContest(app, {
        close: true,
        reveal: true,
        bobScoresAna: 5,
      }));
    });
    When('its host reads the results', async () => {
      const response = await request(app, host, {
        method: 'GET',
        url: `/contests/${contestId}/winners`,
      });
      expect(response.statusCode).toBe(200);
      reveal = response.json();
    });
    Then('both dishes are named as winners', () => {
      expect(reveal.overall.winners.map((w) => w.name).sort()).toEqual([
        'Patatas bravas',
        'Tortilla',
      ]);
    });
  });

  Scenario('The results are held back until the contest is revealed', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let host: CookieJar;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given('a contest that has been fully voted and closed but not revealed', async () => {
      ({ app } = makeTestApp());
      ({ contestId, host } = await playContest(app, { close: true, reveal: false }));
    });
    When('its host reads the results', async () => {
      response = await request(app, host, { method: 'GET', url: `/contests/${contestId}/winners` });
    });
    Then('they are told the results are not out yet', () => {
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('NOT_REVEALED');
    });
  });

  Scenario("A host cannot read another host's results", ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given('a revealed contest belonging to another host', async () => {
      ({ app } = makeTestApp());
      ({ contestId } = await playContest(app, { close: true, reveal: true }));
    });
    When('a host reads its results', async () => {
      const other = await signIn(app, 'other@x.es');
      response = await request(app, other, { method: 'GET', url: `/contests/${contestId}/winners` });
    });
    Then('it is refused as not allowed', () => {
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('NOT_ALLOWED');
    });
  });

  Scenario('Reading the results requires being signed in', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given('a revealed contest', async () => {
      ({ app } = makeTestApp());
      ({ contestId } = await playContest(app, { close: true, reveal: true }));
    });
    When('the results are read with nobody signed in', async () => {
      response = await app.inject({ method: 'GET', url: `/contests/${contestId}/winners` });
    });
    Then('it is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });

  Scenario('The host and the participants see the same results', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let host: CookieJar;
    let ana: CookieJar;
    let contestId: string;
    let hostReveal: Reveal;
    let participantReveal: Reveal;

    Given('a contest that has been fully voted, closed, and revealed', async () => {
      ({ app } = makeTestApp());
      ({ contestId, host, ana } = await playContest(app, { close: true, reveal: true }));
    });
    When('its host and a participant who took part each read the results', async () => {
      const hostResponse = await request(app, host, {
        method: 'GET',
        url: `/contests/${contestId}/winners`,
      });
      const participantResponse = await request(app, ana, {
        method: 'GET',
        url: `/contests/${contestId}/reveal`,
      });
      expect(hostResponse.statusCode).toBe(200);
      expect(participantResponse.statusCode).toBe(200);
      hostReveal = hostResponse.json();
      participantReveal = participantResponse.json();
    });
    Then('the same dishes are named as winners', () => {
      expect(hostReveal.overall.winners).toEqual(participantReveal.overall.winners);
      expect(hostReveal.categories.map((c) => c.winners)).toEqual(
        participantReveal.categories.map((c) => c.winners),
      );
    });
    And('the leaderboard is in the same order for both', () => {
      expect(hostReveal.overall.standings).toEqual(participantReveal.overall.standings);
      expect(hostReveal.categories.map((c) => c.standings)).toEqual(
        participantReveal.categories.map((c) => c.standings),
      );
    });
  });

  Scenario('Both call a dish nobody named the same thing', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let host: CookieJar;
    let ana: CookieJar;
    let contestId: string;
    let hostReveal: Reveal;
    let participantReveal: Reveal;

    Given('a revealed contest where one cook never named their dish', async () => {
      ({ app } = makeTestApp());
      ({ contestId, host, ana } = await contestWithAnUnnamedDish(app));
    });
    When('the host and a participant each read the results', async () => {
      const hostResponse = await request(app, host, { method: 'GET', url: `/contests/${contestId}/winners` });
      const participantResponse = await request(app, ana, { method: 'GET', url: `/contests/${contestId}/reveal` });
      expect(hostResponse.statusCode).toBe(200);
      expect(participantResponse.statusCode).toBe(200);
      hostReveal = hostResponse.json();
      participantReveal = participantResponse.json();
    });
    Then('that dish is called by the same name on both', () => {
      /*
       * Both build their naming from `dishNaming`, so this holds by
       * construction rather than by coincidence. It is asserted anyway: the two
       * routes agreeing by convention until one is edited is precisely the
       * defect this repo keeps finding, and it is what the shared function
       * exists to prevent rather than to make untestable.
       */
      const nameOn = (reveal: Reveal) =>
        reveal.overall.standings.find((standing) => standing.dishId === 'D-bob')?.name;
      expect(nameOn(hostReveal)).toBe('Bob');
      expect(nameOn(participantReveal)).toBe('Bob');
    });
  });
});
