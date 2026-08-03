import { fileURLToPath } from 'node:url';
import { SqliteDatabase } from '../../src/db/sqlite-database.js';
import type { DatabaseSync } from 'node:sqlite';
import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp } from '../support/test-server.js';
import {
  AuditRecorder,
  ClaimPlace,
  CreateDraft,
  createAuditProjection,
  HmacJwtTokenIssuer,
  PublishContest,
  SqliteAuditLogRepository,
  SqliteContestRepository,
  SqliteDraftRepository,
  SqliteRosterRepository,
  SystemClock,
  type Clock,
} from '../../src/index.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./scoring-dishes.feature', import.meta.url)),
);

const CLOCK: Clock = { now: () => '2026-07-21T10:00:00.000Z' };
const SECRET = 'test-secret-that-is-at-least-32-characters';

/** Ana and Bob, no couples, scored 1..5 in "Taste" — Ana may score Bob's dish and vice versa. */
function twoJudgesContent(): DraftContent {
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
  };
}

async function publishLiveContest(db: DatabaseSync, joinCode: string): Promise<{ contestId: string }> {
  const drafts = new SqliteDraftRepository(new SqliteDatabase(db));
  const contests = new SqliteContestRepository(new SqliteDatabase(db));
  const roster = new SqliteRosterRepository(new SqliteDatabase(db));
  const auditLog = new SqliteAuditLogRepository(new SqliteDatabase(db));
  let sequence = 0;
  const ids = { next: () => `audit-${joinCode}-${++sequence}` };
  const audit = new AuditRecorder(auditLog, createAuditProjection({ clock: CLOCK, ids }));

  const created = await new CreateDraft({ drafts, audit, clock: CLOCK, ids }).execute(
    'host-1',
    twoJudgesContent(),
  );
  if (!created.ok) throw new Error('expected draft creation to succeed');
  const published = await new PublishContest({
    drafts,
    contests,
    roster,
    audit,
    clock: CLOCK,
    joinCodes: { next: () => joinCode },
  }).execute(created.draft.id, 'host-1');
  if (!published.ok) throw new Error('expected publish to succeed');
  return { contestId: published.contest.id };
}

async function claimCookie(db: DatabaseSync, joinCode: string, participantId: string): Promise<string> {
  const claim = await new ClaimPlace({
    contests: new SqliteContestRepository(new SqliteDatabase(db)),
    roster: new SqliteRosterRepository(new SqliteDatabase(db)),
    tokens: new HmacJwtTokenIssuer(SECRET, new SystemClock()),
    clock: new SystemClock(),
  }).execute(joinCode, participantId);
  if (!claim.ok) throw new Error(`expected claim to succeed: ${JSON.stringify(claim)}`);
  return `voter_token=${claim.session.refreshToken}`;
}

async function saveScore(
  app: FastifyInstance,
  contestId: string,
  cookie: string,
  body: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: `/contests/${contestId}/scores`,
    headers: { cookie },
    payload: body,
  });
}

async function myScores(
  app: FastifyInstance,
  contestId: string,
  cookie: string,
): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'GET', url: `/contests/${contestId}/scores`, headers: { cookie } });
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('A judge scores a dish that is open to them', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let anaCookie: string;
    let response: LightMyRequestResponse;

    Given("a live contest where Ana may score Bob's dish, scored 1 to 5", async () => {
      ({ app, db } = await makeTestApp());
      ({ contestId } = await publishLiveContest(db, 'TAPAS1'));
      anaCookie = await claimCookie(db, 'TAPAS1', 'ana');
      await claimCookie(db, 'TAPAS1', 'bob');
    });
    When('Ana scores Bob\'s dish 4 for "Taste"', async () => {
      response = await saveScore(app, contestId, anaCookie, {
        dishId: 'D-bob',
        categoryId: 'taste',
        value: 4,
      });
    });
    Then('the score is saved', () => {
      expect(response.statusCode).toBe(201);
      expect(response.json().value).toBe(4);
    });
  });

  Scenario('A judge revises a score before sending', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let anaCookie: string;

    Given('a live contest where Ana has scored Bob\'s dish 4 for "Taste"', async () => {
      ({ app, db } = await makeTestApp());
      ({ contestId } = await publishLiveContest(db, 'TAPAS1'));
      anaCookie = await claimCookie(db, 'TAPAS1', 'ana');
      await claimCookie(db, 'TAPAS1', 'bob');
      await saveScore(app, contestId, anaCookie, {
        dishId: 'D-bob',
        categoryId: 'taste',
        value: 4,
      });
    });
    When('Ana changes that score to 5', async () => {
      const revised = await saveScore(app, contestId, anaCookie, {
        dishId: 'D-bob',
        categoryId: 'taste',
        value: 5,
      });
      expect(revised.statusCode).toBe(201);
    });
    Then("her score for Bob's dish is 5", async () => {
      const scores = (await myScores(app, contestId, anaCookie)).json().scores;
      expect((await scores.find((s: { dishId: string }) => s.dishId === 'D-bob')).value).toBe(5);
    });
    And('she has only one score for that dish and category', async () => {
      const scores = (await myScores(app, contestId, anaCookie)).json().scores;
      expect(
        scores.filter(
          (s: { dishId: string; categoryId: string }) =>
            s.dishId === 'D-bob' && s.categoryId === 'taste',
        ),
      ).toHaveLength(1);
    });
  });

  Scenario('A judge may not score their own dish', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let anaCookie: string;
    let response: LightMyRequestResponse;

    Given('a live contest where Ana has her own dish', async () => {
      ({ app, db } = await makeTestApp());
      ({ contestId } = await publishLiveContest(db, 'TAPAS1'));
      anaCookie = await claimCookie(db, 'TAPAS1', 'ana');
      await claimCookie(db, 'TAPAS1', 'bob');
    });
    When('Ana tries to score her own dish for "Taste"', async () => {
      response = await saveScore(app, contestId, anaCookie, {
        dishId: 'D-ana',
        categoryId: 'taste',
        value: 4,
      });
    });
    Then('scoring is refused because that dish is not open to her', () => {
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('DISH_NOT_OPEN');
    });
  });

  Scenario('A score outside the allowed range is refused', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let anaCookie: string;
    let response: LightMyRequestResponse;

    Given("a live contest where Ana may score Bob's dish, scored 1 to 5", async () => {
      ({ app, db } = await makeTestApp());
      ({ contestId } = await publishLiveContest(db, 'TAPAS1'));
      anaCookie = await claimCookie(db, 'TAPAS1', 'ana');
      await claimCookie(db, 'TAPAS1', 'bob');
    });
    When('Ana tries to score Bob\'s dish 9 for "Taste"', async () => {
      response = await saveScore(app, contestId, anaCookie, {
        dishId: 'D-bob',
        categoryId: 'taste',
        value: 9,
      });
    });
    Then('scoring is refused because the score is out of range', () => {
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('OUT_OF_RANGE');
    });
  });

  Scenario('A score in an unknown category is refused', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let anaCookie: string;
    let response: LightMyRequestResponse;

    Given("a live contest where Ana may score Bob's dish, scored 1 to 5", async () => {
      ({ app, db } = await makeTestApp());
      ({ contestId } = await publishLiveContest(db, 'TAPAS1'));
      anaCookie = await claimCookie(db, 'TAPAS1', 'ana');
      await claimCookie(db, 'TAPAS1', 'bob');
    });
    When("Ana tries to score Bob's dish 4 in a category that does not exist", async () => {
      response = await saveScore(app, contestId, anaCookie, {
        dishId: 'D-bob',
        categoryId: 'ghost',
        value: 4,
      });
    });
    Then('scoring is refused because the category is unknown', () => {
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('UNKNOWN_CATEGORY');
    });
  });

  Scenario('A judge sees their own draft scores', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let anaCookie: string;
    let response: LightMyRequestResponse;

    Given('a live contest where Ana has scored Bob\'s dish 4 for "Taste"', async () => {
      ({ app, db } = await makeTestApp());
      ({ contestId } = await publishLiveContest(db, 'TAPAS1'));
      anaCookie = await claimCookie(db, 'TAPAS1', 'ana');
      await claimCookie(db, 'TAPAS1', 'bob');
      await saveScore(app, contestId, anaCookie, {
        dishId: 'D-bob',
        categoryId: 'taste',
        value: 4,
      });
    });
    When('Ana looks at her scores', async () => {
      response = await myScores(app, contestId, anaCookie);
    });
    Then("her score for Bob's dish is 4", () => {
      expect(response.statusCode).toBe(200);
      const dishScore = response
        .json()
        .scores.find((s: { dishId: string }) => s.dishId === 'D-bob');
      expect(dishScore.value).toBe(4);
    });
  });

  Scenario('A judge is told their vote is still a draft', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let anaCookie: string;
    let response: LightMyRequestResponse;

    Given('a live contest where Ana has scored Bob\'s dish 4 for "Taste"', async () => {
      ({ app, db } = await makeTestApp());
      ({ contestId } = await publishLiveContest(db, 'TAPAS1'));
      anaCookie = await claimCookie(db, 'TAPAS1', 'ana');
      await claimCookie(db, 'TAPAS1', 'bob');
      await saveScore(app, contestId, anaCookie, { dishId: 'D-bob', categoryId: 'taste', value: 4 });
    });
    When('Ana looks at her scores', async () => {
      response = await myScores(app, contestId, anaCookie);
    });
    Then('she is told her vote is still a draft', () => {
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('draft');
    });
  });

  Scenario('A judge sees that their vote has been sent', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let anaCookie: string;
    let response: LightMyRequestResponse;

    Given(
      'a live contest where Ana has scored every dish open to her and sent her vote',
      async () => {
        ({ app, db } = await makeTestApp());
        ({ contestId } = await publishLiveContest(db, 'TAPAS1'));
        anaCookie = await claimCookie(db, 'TAPAS1', 'ana');
        await claimCookie(db, 'TAPAS1', 'bob');
        await saveScore(app, contestId, anaCookie, {
          dishId: 'D-bob',
          categoryId: 'taste',
          value: 4,
        });
        const sent = await app.inject({
          method: 'POST',
          url: `/contests/${contestId}/send-vote`,
          headers: { cookie: anaCookie },
        });
        expect(sent.statusCode).toBe(200);
      },
    );
    When('Ana looks at her scores', async () => {
      response = await myScores(app, contestId, anaCookie);
    });
    Then('she is told her vote has been sent', () => {
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('sent');
    });
    // Sending must not hide what she gave — a read-only view still needs the scores.
    And('she still sees the scores she gave', () => {
      const dishScore = response
        .json()
        .scores.find((s: { dishId: string }) => s.dishId === 'D-bob');
      expect(dishScore.value).toBe(4);
    });
  });

  Scenario('Scoring requires having claimed a place', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given('a live contest', async () => {
      ({ app, db } = await makeTestApp());
      ({ contestId } = await publishLiveContest(db, 'TAPAS1'));
    });
    When('a score is saved with no participant token', async () => {
      response = await app.inject({
        method: 'POST',
        url: `/contests/${contestId}/scores`,
        payload: { dishId: 'D-bob', categoryId: 'taste', value: 4 },
      });
    });
    Then('scoring is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });
});
