import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp, seedHost } from '../support/test-server.js';

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
  await seedHost(app, 'h@x.es', STRONG_PASSWORD);
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

/**
 * A contest still in play, with the room deliberately uneven: Ana has sent,
 * Bob has scored one dish and NOT sent, Carol never claimed a place at all.
 *
 * That mix is the point. Bob and Carol must be indistinguishable in the answer
 * — "not in" — and Carol still has to be counted in what the votes are expected
 * out of, or the screen reads "everyone has voted" while the reveal never comes.
 */
async function contestInPlay(app: FastifyInstance, hostEmail = 'h@x.es') {
  const host = new CookieJar();
  await seedHost(app, hostEmail, STRONG_PASSWORD);
  await request(app, host, { method: 'POST', url: '/auth/login', payload: { email: hostEmail, password: STRONG_PASSWORD } });
  const threeOfThem: DraftContent = {
    ...content(),
    participants: [
      { id: 'ana', displayName: 'Ana' },
      { id: 'bob', displayName: 'Bob' },
      { id: 'carol', displayName: 'Carol' },
    ],
  };
  const created = await request(app, host, { method: 'POST', url: '/drafts', payload: threeOfThem });
  const published = await request(app, host, { method: 'POST', url: `/drafts/${created.json().id}/publish` });
  const contestId = published.json().id as string;
  const joinCode = published.json().joinCode as string;

  const ana = await claim(app, joinCode, 'ana');
  const bob = await claim(app, joinCode, 'bob');
  for (const [jar, name] of [[ana, 'Patatas bravas'], [bob, 'Tortilla']] as const) {
    await request(app, jar, { method: 'POST', url: `/contests/${contestId}/dishes`, payload: { name } });
  }
  // Ana scores both dishes open to her and sends; Bob scores one and stops.
  /*
   * Ana scores every dish open to her and sends. Read from her ballot rather
   * than assumed: a dish is materialized for every place on the roster, so
   * Carol's exists to be scored even though Carol never submitted one, and a
   * hand-written list of dish ids sends an INCOMPLETE vote that quietly leaves
   * this whole scenario with nothing in it.
   */
  const ballot = await request(app, ana, { method: 'GET', url: `/contests/${contestId}/ballot` });
  for (const dish of ballot.json().dishes as { dishId: string }[]) {
    await request(app, ana, { method: 'POST', url: `/contests/${contestId}/scores`, payload: { dishId: dish.dishId, categoryId: 'taste', value: 5 } });
  }
  const sent = await request(app, ana, { method: 'POST', url: `/contests/${contestId}/send-vote` });
  expect(sent.statusCode).toBe(200);

  // Bob scores one dish and stops — part-way through, and not in.
  await request(app, bob, { method: 'POST', url: `/contests/${contestId}/scores`, payload: { dishId: 'D-ana', categoryId: 'taste', value: 3 } });

  return { contestId, ana, bob };
}

interface Turnout {
  votesIn: number;
  votesExpected: number;
  participants: { participantId: string; displayName: string; sent: boolean }[];
}

/** Publishes `draft`, returning the contest id, its join code and the host's jar. */
async function publish(app: FastifyInstance, hostEmail: string, draft: DraftContent) {
  const host = new CookieJar();
  await seedHost(app, hostEmail, STRONG_PASSWORD);
  await request(app, host, { method: 'POST', url: '/auth/login', payload: { email: hostEmail, password: STRONG_PASSWORD } });
  const created = await request(app, host, { method: 'POST', url: '/drafts', payload: draft });
  const published = await request(app, host, { method: 'POST', url: `/drafts/${created.json().id}/publish` });
  expect(published.statusCode).toBe(201);
  return { host, contestId: published.json().id as string, joinCode: published.json().joinCode as string };
}

/** Closes and reveals, so the results can be read. */
async function closeAndReveal(app: FastifyInstance, host: CookieJar, contestId: string) {
  await request(app, host, { method: 'POST', url: `/contests/${contestId}/close` });
  await request(app, host, { method: 'POST', url: `/contests/${contestId}/reveal` });
}

/** Ana and Bob score each other's dish the same, so the two tie on equal totals. */
async function tiedContest(app: FastifyInstance) {
  const { host, contestId, joinCode } = await publish(app, 'tie@x.es', content());
  const ana = await claim(app, joinCode, 'ana');
  const bob = await claim(app, joinCode, 'bob');
  await request(app, ana, { method: 'POST', url: `/contests/${contestId}/dishes`, payload: { name: 'Patatas bravas' } });
  await request(app, bob, { method: 'POST', url: `/contests/${contestId}/dishes`, payload: { name: 'Tortilla' } });
  for (const [jar, dishId] of [[ana, 'D-bob'], [bob, 'D-ana']] as const) {
    await request(app, jar, { method: 'POST', url: `/contests/${contestId}/scores`, payload: { dishId, categoryId: 'taste', value: 5 } });
    expect((await request(app, jar, { method: 'POST', url: `/contests/${contestId}/send-vote` })).statusCode).toBe(200);
  }
  await closeAndReveal(app, host, contestId);
  return { contestId, ana };
}

/**
 * `per_couple`: Ana and Bob are partners and bring ONE dish between them; Carol
 * brings her own. Carol rates theirs highest, so the shared dish wins and has to
 * name both of the people who made it.
 */
async function sharedDishContest(app: FastifyInstance) {
  const couples: DraftContent = {
    ...content(),
    attribution: 'per_couple',
    participants: [
      { id: 'ana', displayName: 'Ana', partnerId: 'bob' },
      { id: 'bob', displayName: 'Bob', partnerId: 'ana' },
      { id: 'carol', displayName: 'Carol' },
    ],
  };
  const { host, contestId, joinCode } = await publish(app, 'couple@x.es', couples);
  const ana = await claim(app, joinCode, 'ana');
  const carol = await claim(app, joinCode, 'carol');
  await request(app, ana, { method: 'POST', url: `/contests/${contestId}/dishes`, payload: { name: 'Tortilla for two' } });
  await request(app, carol, { method: 'POST', url: `/contests/${contestId}/dishes`, payload: { name: 'Gazpacho' } });

  // Each scores every dish open to them: Carol theirs, Ana Carol's.
  await request(app, carol, { method: 'POST', url: `/contests/${contestId}/scores`, payload: { dishId: 'D-ana-bob', categoryId: 'taste', value: 5 } });
  expect((await request(app, carol, { method: 'POST', url: `/contests/${contestId}/send-vote` })).statusCode).toBe(200);
  await request(app, ana, { method: 'POST', url: `/contests/${contestId}/scores`, payload: { dishId: 'D-carol', categoryId: 'taste', value: 1 } });
  expect((await request(app, ana, { method: 'POST', url: `/contests/${contestId}/send-vote` })).statusCode).toBe(200);

  await closeAndReveal(app, host, contestId);
  return { contestId, ana };
}

interface RevealWinner {
  dishId: string;
  name: string;
  cooks: string[];
}

interface Reveal {
  contestName: string;
  overall: { winners: RevealWinner[]; standings: { dishId: string; name: string; total: number }[] };
  categories: { categoryId: string; name: string; winners: RevealWinner[] }[];
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

  Scenario('The winning dish names the cook who brought it', ({ Given, When, Then }) => {
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
    Then('the winning dish is named, and so is the participant who brought it', () => {
      // Bob's tortilla wins; Bob brought it. The dish keeps the name it was
      // submitted under — the cook is named ALONGSIDE it, never instead of it.
      expect(reveal.overall.winners).toEqual([
        { dishId: 'D-bob', name: 'Tortilla', cooks: ['Bob'] },
      ]);
    });
  });

  Scenario('Joint winners each name their own cook', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let ana: CookieJar;
    let contestId: string;
    let reveal: Reveal;

    Given('a revealed contest that ended in a tie', async () => {
      ({ app } = makeTestApp());
      ({ contestId, ana } = await tiedContest(app));
    });
    When('a participant who took part reads the results', async () => {
      const response = await request(app, ana, { method: 'GET', url: `/contests/${contestId}/reveal` });
      expect(response.statusCode).toBe(200);
      reveal = response.json();
    });
    Then('each winning dish is named, and so is the participant who brought it', () => {
      expect(reveal.overall.winners).toHaveLength(2);
      // Each winner carries its OWN cook — not a shared list of everyone who tied.
      expect(reveal.overall.winners).toContainEqual({
        dishId: 'D-ana',
        name: 'Patatas bravas',
        cooks: ['Ana'],
      });
      expect(reveal.overall.winners).toContainEqual({
        dishId: 'D-bob',
        name: 'Tortilla',
        cooks: ['Bob'],
      });
    });
  });

  Scenario('A dish brought by two people names them both', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let ana: CookieJar;
    let contestId: string;
    let reveal: Reveal;

    Given('a revealed contest where two partners shared a dish', async () => {
      ({ app } = makeTestApp());
      ({ contestId, ana } = await sharedDishContest(app));
    });
    When('a participant who took part reads the results', async () => {
      const response = await request(app, ana, { method: 'GET', url: `/contests/${contestId}/reveal` });
      expect(response.statusCode).toBe(200);
      reveal = response.json();
    });
    Then('the dish they shared names both of them', () => {
      /*
       * Under `per_couple` a dish genuinely has two cooks, which is why the
       * field is a list. Naming one of them would be the API choosing which
       * half of a couple cooked, in the one moment of the evening that names
       * people at all.
       */
      expect(reveal.overall.winners).toEqual([
        { dishId: 'D-ana-bob', name: 'Tortilla for two', cooks: ['Ana', 'Bob'] },
      ]);
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

  Scenario('How the voting stands says how many are in, out of how many', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let ana: CookieJar;
    let contestId: string;
    let turnout: Turnout;

    Given('a contest where one participant has sent their vote and one has not', async () => {
      ({ app } = makeTestApp());
      ({ contestId, ana } = await contestInPlay(app));
    });
    When('a participant who took part reads how the voting stands', async () => {
      const response = await request(app, ana, { method: 'GET', url: `/contests/${contestId}/turnout` });
      expect(response.statusCode).toBe(200);
      turnout = response.json();
    });
    Then('they are told how many votes are in, out of how many are expected', () => {
      expect(turnout.votesIn).toBe(1);
      // Three places, including the one Carol never took.
      expect(turnout.votesExpected).toBe(3);
    });
  });

  Scenario('How the voting stands names who has still to vote', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let ana: CookieJar;
    let contestId: string;
    let turnout: Turnout;

    Given('a contest where one participant has sent their vote and one has not', async () => {
      ({ app } = makeTestApp());
      ({ contestId, ana } = await contestInPlay(app));
    });
    When('a participant who took part reads how the voting stands', async () => {
      const response = await request(app, ana, { method: 'GET', url: `/contests/${contestId}/turnout` });
      expect(response.statusCode).toBe(200);
      turnout = response.json();
    });
    Then('the one who has not sent is named as still to vote', () => {
      expect(turnout.participants).toContainEqual({ participantId: 'bob', displayName: 'Bob', sent: false });
    });
    And('the one who has sent is marked as in', () => {
      expect(turnout.participants).toContainEqual({ participantId: 'ana', displayName: 'Ana', sent: true });
    });
  });

  Scenario('How far someone has got is not reported', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let ana: CookieJar;
    let contestId: string;
    let body: string;
    let turnout: Turnout;

    Given('a contest where one participant has scored some dishes but not sent', async () => {
      ({ app } = makeTestApp());
      ({ contestId, ana } = await contestInPlay(app)); // Bob has one score saved, unsent
    });
    When('a participant who took part reads how the voting stands', async () => {
      const response = await request(app, ana, { method: 'GET', url: `/contests/${contestId}/turnout` });
      expect(response.statusCode).toBe(200);
      body = response.body;
      turnout = response.json();
    });
    Then('nothing in the answer says what has been scored, or how much', () => {
      /*
       * Bob has a score in a draft session; Carol has no session at all. If the
       * answer told them apart in any way, "how far someone has got" would be
       * derivable from it — so they must be identical but for the name.
       */
      const withoutIdentity = (id: string) => {
        const found = turnout.participants.find((p) => p.participantId === id);
        expect(found).toBeDefined();
        const { participantId: _id, displayName: _name, ...rest } = found!;
        return rest;
      };
      // Identical but for who they are: same keys, same values, no tell.
      expect(withoutIdentity('bob')).toEqual(withoutIdentity('carol'));
      // And nothing about scores travels in the payload at all.
      for (const leak of ['score', 'value', 'draft', 'dish', 'progress', 'started']) {
        expect(body.toLowerCase()).not.toContain(leak);
      }
    });
  });

  Scenario('How the voting stands is refused to anyone who did not take part', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given('a contest in play', async () => {
      ({ app } = makeTestApp());
      ({ contestId } = await contestInPlay(app));
    });
    When('how the voting stands is read with no participant token', async () => {
      response = await app.inject({ method: 'GET', url: `/contests/${contestId}/turnout` });
    });
    Then('it is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });

  Scenario('How the voting stands carries nothing about another contest', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let ana: CookieJar;
    let otherContestId: string;
    let response: LightMyRequestResponse;

    Given('a participant who took part in one of two contests in play', async () => {
      ({ app } = makeTestApp());
      ({ ana } = await contestInPlay(app));
      // A second contest, a different host, a roster with nobody in common.
      const other = new CookieJar();
      await seedHost(app, 'other@x.es', STRONG_PASSWORD);
      await request(app, other, { method: 'POST', url: '/auth/login', payload: { email: 'other@x.es', password: STRONG_PASSWORD } });
      const draft: DraftContent = {
        ...content(),
        name: 'Someone else’s evening',
        participants: [
          { id: 'iker', displayName: 'Iker' },
          { id: 'nuria', displayName: 'Nuria' },
        ],
      };
      const created = await request(app, other, { method: 'POST', url: '/drafts', payload: draft });
      const published = await request(app, other, { method: 'POST', url: `/drafts/${created.json().id}/publish` });
      otherContestId = published.json().id as string;
    });
    When('they ask how the voting stands in the contest they had no part in', async () => {
      // The other contest's id, carrying Ana's token for hers.
      response = await request(app, ana, { method: 'GET', url: `/contests/${otherContestId}/turnout` });
    });
    Then('it is refused, and names nobody from it', () => {
      /*
       * Refused outright rather than quietly answered about Ana's own contest.
       * `requireVoterSession` compares the token's contest against the one in
       * the address and refuses a mismatch, so a participant cannot even ask
       * about a room they are not in — and the refusal carries no roster.
       */
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('NOT_ALLOWED');
      expect(response.body).not.toContain('Iker');
      expect(response.body).not.toContain('Nuria');
    });
  });
});
