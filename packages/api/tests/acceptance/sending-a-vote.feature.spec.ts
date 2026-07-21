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
  fileURLToPath(new URL('./sending-a-vote.feature', import.meta.url)),
);

const CLOCK: Clock = { now: () => '2026-07-21T10:00:00.000Z' };
const SECRET = 'test-secret-that-is-at-least-32-characters';

/** Ana and Bob, no couples, scored 1..5 in "Taste" — not a ranking contest. */
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

/** Ana, Bob, Carol, no couples, scored 1..5 in "Taste" — Ana has two dishes she may score. */
function threeJudgesContent(): DraftContent {
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
      { id: 'carol', displayName: 'Carol' },
    ],
  };
}

/** Ana, Bob, Carol — a strict ranking: Ana's two allowed dishes must use 1 and 2, one each, in "Taste". */
function rankingContent(): DraftContent {
  return {
    name: 'Tapas',
    attribution: 'per_person',
    antiBias: 'none',
    scoring: {
      categories: [{ id: 'taste', name: 'Taste' }],
      range: { type: 'auto' },
      uniquePerCategory: true,
    },
    participants: [
      { id: 'ana', displayName: 'Ana' },
      { id: 'bob', displayName: 'Bob' },
      { id: 'carol', displayName: 'Carol' },
    ],
  };
}

function publishLiveContest(
  db: DatabaseSync,
  joinCode: string,
  content: DraftContent,
): { contestId: string } {
  const drafts = new SqliteDraftRepository(db);
  const contests = new SqliteContestRepository(db);
  const roster = new SqliteRosterRepository(db);
  const auditLog = new SqliteAuditLogRepository(db);
  let sequence = 0;
  const ids = { next: () => `audit-${joinCode}-${++sequence}` };
  const audit = new AuditRecorder(auditLog, createAuditProjection({ clock: CLOCK, ids }));

  const created = new CreateDraft({ drafts, audit, clock: CLOCK, ids }).execute('host-1', content);
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

async function sendVote(
  app: FastifyInstance,
  contestId: string,
  cookie: string,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: `/contests/${contestId}/send-vote`,
    headers: { cookie },
  });
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('A judge sends a complete vote', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let anaCookie: string;
    let response: LightMyRequestResponse;

    Given(
      'a live contest where Ana has scored every dish open to her, in every category',
      async () => {
        ({ app, db } = makeTestApp());
        ({ contestId } = publishLiveContest(db, 'TAPAS1', twoJudgesContent()));
        anaCookie = claimCookie(db, 'TAPAS1', 'ana');
        claimCookie(db, 'TAPAS1', 'bob');
        await saveScore(app, contestId, anaCookie, {
          dishId: 'D-bob',
          categoryId: 'taste',
          value: 4,
        });
      },
    );
    When('Ana sends her vote', async () => {
      response = await sendVote(app, contestId, anaCookie);
    });
    Then('her vote is locked as sent', () => {
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('sent');
    });
  });

  Scenario('An incomplete vote cannot be sent', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let anaCookie: string;
    let response: LightMyRequestResponse;

    Given('a live contest where Ana has left a dish unscored', async () => {
      ({ app, db } = makeTestApp());
      ({ contestId } = publishLiveContest(db, 'TAPAS1', threeJudgesContent()));
      anaCookie = claimCookie(db, 'TAPAS1', 'ana');
      claimCookie(db, 'TAPAS1', 'bob');
      claimCookie(db, 'TAPAS1', 'carol');
      // Ana scores Bob's dish but never Carol's.
      await saveScore(app, contestId, anaCookie, {
        dishId: 'D-bob',
        categoryId: 'taste',
        value: 4,
      });
    });
    When('Ana tries to send her vote', async () => {
      response = await sendVote(app, contestId, anaCookie);
    });
    Then('sending is refused because her vote is incomplete', () => {
      expect(response.statusCode).toBe(422);
      expect(response.json().error.code).toBe('INCOMPLETE');
    });
  });

  Scenario('A ranking vote must use each value exactly once', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let anaCookie: string;
    let response: LightMyRequestResponse;

    Given(
      'a live contest that requires a strict ranking, where Ana has given two dishes the same score in "Taste"',
      async () => {
        ({ app, db } = makeTestApp());
        ({ contestId } = publishLiveContest(db, 'TAPAS1', rankingContent()));
        anaCookie = claimCookie(db, 'TAPAS1', 'ana');
        claimCookie(db, 'TAPAS1', 'bob');
        claimCookie(db, 'TAPAS1', 'carol');
        await saveScore(app, contestId, anaCookie, {
          dishId: 'D-bob',
          categoryId: 'taste',
          value: 1,
        });
        await saveScore(app, contestId, anaCookie, {
          dishId: 'D-carol',
          categoryId: 'taste',
          value: 1,
        });
      },
    );
    When('Ana tries to send her vote', async () => {
      response = await sendVote(app, contestId, anaCookie);
    });
    Then('sending is refused because each score in that category must be used exactly once', () => {
      expect(response.statusCode).toBe(422);
      expect(response.json().error.code).toBe('DUPLICATE_CATEGORY_VALUE');
    });
  });

  Scenario('A sent vote cannot be changed', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let anaCookie: string;
    let response: LightMyRequestResponse;

    Given('a live contest where Ana has sent her vote', async () => {
      ({ app, db } = makeTestApp());
      ({ contestId } = publishLiveContest(db, 'TAPAS1', twoJudgesContent()));
      anaCookie = claimCookie(db, 'TAPAS1', 'ana');
      claimCookie(db, 'TAPAS1', 'bob');
      await saveScore(app, contestId, anaCookie, {
        dishId: 'D-bob',
        categoryId: 'taste',
        value: 4,
      });
      await sendVote(app, contestId, anaCookie);
    });
    When('Ana tries to save another score', async () => {
      response = await saveScore(app, contestId, anaCookie, {
        dishId: 'D-bob',
        categoryId: 'taste',
        value: 5,
      });
    });
    Then('saving is refused because her vote has already been sent', () => {
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('SESSION_LOCKED');
    });
  });

  Scenario('A vote cannot be sent twice', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let anaCookie: string;
    let response: LightMyRequestResponse;

    Given('a live contest where Ana has sent her vote', async () => {
      ({ app, db } = makeTestApp());
      ({ contestId } = publishLiveContest(db, 'TAPAS1', twoJudgesContent()));
      anaCookie = claimCookie(db, 'TAPAS1', 'ana');
      claimCookie(db, 'TAPAS1', 'bob');
      await saveScore(app, contestId, anaCookie, {
        dishId: 'D-bob',
        categoryId: 'taste',
        value: 4,
      });
      await sendVote(app, contestId, anaCookie);
    });
    When('Ana tries to send her vote again', async () => {
      response = await sendVote(app, contestId, anaCookie);
    });
    Then('sending is refused because her vote has already been sent', () => {
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('ALREADY_SENT');
    });
  });

  Scenario('Sending a vote requires having claimed a place', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given('a live contest', () => {
      ({ app, db } = makeTestApp());
      ({ contestId } = publishLiveContest(db, 'TAPAS1', twoJudgesContent()));
    });
    When('a vote is sent with no participant token', async () => {
      response = await app.inject({ method: 'POST', url: `/contests/${contestId}/send-vote` });
    });
    Then('sending is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });
});
