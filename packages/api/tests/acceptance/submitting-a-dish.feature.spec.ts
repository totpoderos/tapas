import { fileURLToPath } from 'node:url';
import { SqliteDatabase } from '../../src/db/sqlite-database.js';
import type { DatabaseSync } from 'node:sqlite';
import type { ContestFormat, DraftContent } from '@tapas/domain';
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
  fileURLToPath(new URL('./submitting-a-dish.feature', import.meta.url)),
);

const CLOCK: Clock = { now: () => '2026-07-21T10:00:00.000Z' };
const SECRET = 'test-secret-that-is-at-least-32-characters';

function person(id: string, displayName: string, partnerId: string) {
  return { id, displayName, partnerId };
}

/** A complete, publishable draft in the given format, with 2 couples (4 people). */
function completeContent(format: ContestFormat): DraftContent {
  return {
    name: 'Tapas',
    format,
    scoring: {
      categories: [{ id: 'c1', name: 'Taste' }],
      range: { type: 'auto' },
      uniquePerCategory: true,
    },
    participants: [
      person('maria', 'María', 'pau'),
      person('pau', 'Pau', 'maria'),
      person('ana', 'Ana', 'marcos'),
      person('marcos', 'Marcos', 'ana'),
    ],
  };
}

/** Publishes a live contest against the app's db, returning { contestId, joinCode }. */
async function publishLiveContest(
  db: DatabaseSync,
  joinCode: string,
  format: ContestFormat = 'solo_with_partners',
) {
  const drafts = new SqliteDraftRepository(new SqliteDatabase(db));
  const contests = new SqliteContestRepository(new SqliteDatabase(db));
  const roster = new SqliteRosterRepository(new SqliteDatabase(db));
  const auditLog = new SqliteAuditLogRepository(new SqliteDatabase(db));
  let sequence = 0;
  const ids = { next: () => `audit-${joinCode}-${++sequence}` };
  const audit = new AuditRecorder(auditLog, createAuditProjection({ clock: CLOCK, ids }));

  const created = await new CreateDraft({ drafts, audit, clock: CLOCK, ids }).execute(
    'host-1',
    completeContent(format),
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
  return { contestId: published.contest.id, joinCode };
}

/** Claims a place directly and returns the voter cookie header. */
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

async function submitDish(
  app: FastifyInstance,
  contestId: string,
  cookie: string,
  body: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: `/contests/${contestId}/dishes`,
    headers: { cookie },
    payload: body,
  });
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('A cook submits their dish', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let cookie: string;
    let response: LightMyRequestResponse;

    Given('a live contest where "Ana" has claimed her place', async () => {
      ({ app, db } = await makeTestApp());
      ({ contestId } = await publishLiveContest(db, 'TAPAS1'));
      cookie = await claimCookie(db, 'TAPAS1', 'ana');
    });
    When('Ana submits a dish named "Patatas bravas"', async () => {
      response = await submitDish(app, contestId, cookie, { name: 'Patatas bravas' });
    });
    Then('her dish is recorded as "Patatas bravas"', () => {
      expect(response.statusCode).toBe(201);
      expect(response.json().name).toBe('Patatas bravas');
    });
  });

  Scenario(
    'A cook revises their dish rather than adding a second',
    ({ Given, When, Then, And }) => {
      let app: FastifyInstance;
      let db: DatabaseSync;
      let contestId: string;
      let cookie: string;

      Given('a live contest where "Ana" has submitted "Patatas bravas"', async () => {
        ({ app, db } = await makeTestApp());
        ({ contestId } = await publishLiveContest(db, 'TAPAS1'));
        cookie = await claimCookie(db, 'TAPAS1', 'ana');
        await submitDish(app, contestId, cookie, { name: 'Patatas bravas' });
      });
      When('Ana submits her dish again as "Patatas bravas picantes"', async () => {
        const revised = await submitDish(app, contestId, cookie, {
          name: 'Patatas bravas picantes',
        });
        expect(revised.statusCode).toBe(201);
      });
      Then('her dish is now "Patatas bravas picantes"', async () => {
        const list = await app.inject({
          method: 'GET',
          url: `/contests/${contestId}/dishes`,
          headers: { cookie },
        });
        const anaDish = list
          .json()
          .dishes.find((dish: { submitterIds: string[] }) => dish.submitterIds.includes('ana'));
        expect(anaDish.name).toBe('Patatas bravas picantes');
      });
      And('she still has only one dish', async () => {
        const list = await app.inject({
          method: 'GET',
          url: `/contests/${contestId}/dishes`,
          headers: { cookie },
        });
        expect(list.json().dishes).toHaveLength(1);
      });
    },
  );

  Scenario('A dish must have a name', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let cookie: string;
    let response: LightMyRequestResponse;

    Given('a live contest where "Ana" has claimed her place', async () => {
      ({ app, db } = await makeTestApp());
      ({ contestId } = await publishLiveContest(db, 'TAPAS1'));
      cookie = await claimCookie(db, 'TAPAS1', 'ana');
    });
    When('Ana submits a dish with no name', async () => {
      response = await submitDish(app, contestId, cookie, { name: '' });
    });
    Then('submitting is refused because a name is required', () => {
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('NAME_REQUIRED');
    });
  });

  Scenario('Submitting a dish requires having claimed a place', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given('a live contest', async () => {
      ({ app, db } = await makeTestApp());
      ({ contestId } = await publishLiveContest(db, 'TAPAS1'));
    });
    When('a dish is submitted with no participant token', async () => {
      response = await app.inject({
        method: 'POST',
        url: `/contests/${contestId}/dishes`,
        payload: { name: 'Sneaky' },
      });
    });
    Then('submitting is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });

  Scenario('Everyone taking part can see the dishes submitted so far', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given('a live contest where "Ana" has submitted "Patatas bravas"', async () => {
      ({ app, db } = await makeTestApp());
      ({ contestId } = await publishLiveContest(db, 'TAPAS1'));
      await submitDish(app, contestId, await claimCookie(db, 'TAPAS1', 'ana'), {
        name: 'Patatas bravas',
      });
    });
    When("a participant lists the contest's dishes", async () => {
      // Pau, another participant, lists the dishes.
      response = await app.inject({
        method: 'GET',
        url: `/contests/${contestId}/dishes`,
        headers: { cookie: await claimCookie(db, 'TAPAS1', 'pau') },
      });
    });
    Then('"Patatas bravas" is among them', () => {
      expect(response.statusCode).toBe(200);
      const names = response.json().dishes.map((dish: { name: string }) => dish.name);
      expect(names).toContain('Patatas bravas');
    });
  });

  Scenario('Partners share one dish, and either may submit it', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;

    Given('a live contest where "Ana" and "Marcos" are partners sharing a dish', async () => {
      ({ app, db } = await makeTestApp());
      ({ contestId } = await publishLiveContest(db, 'TAPAS1', 'couples'));
    });
    When('Marcos submits their dish as "Tortilla"', async () => {
      const submitted = await submitDish(app, contestId, await claimCookie(db, 'TAPAS1', 'marcos'), {
        name: 'Tortilla',
      });
      expect(submitted.statusCode).toBe(201);
    });
    Then('the couple\'s single dish is recorded as "Tortilla"', async () => {
      const list = await app.inject({
        method: 'GET',
        url: `/contests/${contestId}/dishes`,
        headers: { cookie: await claimCookie(db, 'TAPAS1', 'maria') },
      });
      const coupleDish = list
        .json()
        .dishes.find((dish: { submitterIds: string[] }) => dish.submitterIds.includes('ana'));
      expect(coupleDish.name).toBe('Tortilla');
      expect(coupleDish.submitterIds).toContain('marcos');
    });
    And('Ana sees the same dish as hers', async () => {
      const me = await app.inject({
        method: 'GET',
        url: `/contests/${contestId}/dishes`,
        headers: { cookie: await claimCookie(db, 'TAPAS1', 'ana') },
      });
      const anaDish = me
        .json()
        .dishes.find((dish: { submitterIds: string[] }) => dish.submitterIds.includes('ana'));
      expect(anaDish.name).toBe('Tortilla');
    });
  });
});
