import { fileURLToPath } from 'node:url';
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

function publishLiveContest(db: DatabaseSync, joinCode: string): { contestId: string } {
  const drafts = new SqliteDraftRepository(db);
  const contests = new SqliteContestRepository(db);
  const roster = new SqliteRosterRepository(db);
  const auditLog = new SqliteAuditLogRepository(db);
  let sequence = 0;
  const ids = { next: () => `audit-${joinCode}-${++sequence}` };
  const audit = new AuditRecorder(auditLog, createAuditProjection({ clock: CLOCK, ids }));

  const created = new CreateDraft({ drafts, audit, clock: CLOCK, ids }).execute(
    'host-1',
    twoJudgesContent(),
  );
  if (!created.ok) throw new Error('expected draft creation to succeed');
  const published = new PublishContest({
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

function claimCookie(db: DatabaseSync, joinCode: string, participantId: string): string {
  const claim = new ClaimPlace({
    contests: new SqliteContestRepository(db),
    roster: new SqliteRosterRepository(db),
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

    Given("a live contest where Ana may score Bob's dish, scored 1 to 5", () => {
      ({ app, db } = makeTestApp());
      ({ contestId } = publishLiveContest(db, 'TAPAS1'));
      anaCookie = claimCookie(db, 'TAPAS1', 'ana');
      claimCookie(db, 'TAPAS1', 'bob');
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
      ({ app, db } = makeTestApp());
      ({ contestId } = publishLiveContest(db, 'TAPAS1'));
      anaCookie = claimCookie(db, 'TAPAS1', 'ana');
      claimCookie(db, 'TAPAS1', 'bob');
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
      expect(scores.find((s: { dishId: string }) => s.dishId === 'D-bob').value).toBe(5);
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

    Given('a live contest where Ana has her own dish', () => {
      ({ app, db } = makeTestApp());
      ({ contestId } = publishLiveContest(db, 'TAPAS1'));
      anaCookie = claimCookie(db, 'TAPAS1', 'ana');
      claimCookie(db, 'TAPAS1', 'bob');
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

    Given("a live contest where Ana may score Bob's dish, scored 1 to 5", () => {
      ({ app, db } = makeTestApp());
      ({ contestId } = publishLiveContest(db, 'TAPAS1'));
      anaCookie = claimCookie(db, 'TAPAS1', 'ana');
      claimCookie(db, 'TAPAS1', 'bob');
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

    Given("a live contest where Ana may score Bob's dish, scored 1 to 5", () => {
      ({ app, db } = makeTestApp());
      ({ contestId } = publishLiveContest(db, 'TAPAS1'));
      anaCookie = claimCookie(db, 'TAPAS1', 'ana');
      claimCookie(db, 'TAPAS1', 'bob');
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
      ({ app, db } = makeTestApp());
      ({ contestId } = publishLiveContest(db, 'TAPAS1'));
      anaCookie = claimCookie(db, 'TAPAS1', 'ana');
      claimCookie(db, 'TAPAS1', 'bob');
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

  Scenario('Scoring requires having claimed a place', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given('a live contest', () => {
      ({ app, db } = makeTestApp());
      ({ contestId } = publishLiveContest(db, 'TAPAS1'));
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
