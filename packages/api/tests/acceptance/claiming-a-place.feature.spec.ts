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
  fileURLToPath(new URL('./claiming-a-place.feature', import.meta.url)),
);

const CLOCK: Clock = { now: () => '2026-07-20T10:00:00.000Z' };

function person(id: string, displayName: string, partnerId: string) {
  return { id, displayName, partnerId };
}

/** A complete, publishable draft whose participants have the given ids + names. */
function completeContent(name: string): DraftContent {
  return {
    name,
    attribution: 'per_person',
    antiBias: 'couples',
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

/** Publishes a live contest directly against the app's own database, returning its join code. */
function publishLiveContest(db: DatabaseSync, joinCode: string): string {
  const drafts = new SqliteDraftRepository(db);
  const contests = new SqliteContestRepository(db);
  const roster = new SqliteRosterRepository(db);
  const auditLog = new SqliteAuditLogRepository(db);
  let sequence = 0;
  const ids = { next: () => `audit-${joinCode}-${++sequence}` };
  const audit = new AuditRecorder(auditLog, createAuditProjection({ clock: CLOCK, ids }));

  const created = new CreateDraft({ drafts, audit, clock: CLOCK, ids }).execute(
    'host-1',
    completeContent('Tapas'),
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
  return published.contest.id;
}

/** Directly claims a place (used to set up an already-taken place), returning the voter cookie. */
function claimDirectly(db: DatabaseSync, joinCode: string, participantId: string): string {
  const claim = new ClaimPlace({
    contests: new SqliteContestRepository(db),
    roster: new SqliteRosterRepository(db),
    tokens: new HmacJwtTokenIssuer('test-secret-that-is-at-least-32-characters', new SystemClock()),
    clock: new SystemClock(),
  }).execute(joinCode, participantId);
  if (!claim.ok) throw new Error(`expected direct claim to succeed, got ${JSON.stringify(claim)}`);
  return `voter_token=${claim.session.refreshToken}`;
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('The whole roster is shown for a valid code', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let response: LightMyRequestResponse;

    Given('a live contest whose participants are "María", "Pau" and "Ana"', () => {
      ({ app, db } = makeTestApp());
      publishLiveContest(db, 'TAPAS1');
    });
    When('someone looks up the contest by its join code', async () => {
      response = await app.inject({ method: 'GET', url: '/contests/TAPAS1/places' });
    });
    Then('all three places are returned, and each is marked open or taken', () => {
      expect(response.statusCode).toBe(200);
      const places = response.json().places as { displayName: string; taken: boolean }[];
      const names = places.map((place) => place.displayName);
      expect(names).toContain('María');
      expect(names).toContain('Pau');
      expect(names).toContain('Ana');
      // Nobody has arrived yet, and every place says so rather than leaving it open to guess.
      expect(places.every((place) => place.taken === false)).toBe(true);
    });
  });

  Scenario('A taken place is shown as taken, and is not offered to be claimed', ({
    Given,
    When,
    Then,
    And,
  }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let response: LightMyRequestResponse;

    Given('a live contest where "Ana"\'s place is already taken', async () => {
      ({ app, db } = makeTestApp());
      publishLiveContest(db, 'TAPAS4');
      await app.inject({
        method: 'POST',
        url: '/contests/TAPAS4/claim',
        payload: { participantId: 'ana' },
      });
    });
    When('someone looks up the contest by its join code', async () => {
      response = await app.inject({ method: 'GET', url: '/contests/TAPAS4/places' });
    });
    Then('"Ana"\'s place is marked as taken', () => {
      expect(response.statusCode).toBe(200);
      const places = response.json().places as { displayName: string; taken: boolean }[];
      const ana = places.find((place) => place.displayName === 'Ana');
      expect(ana?.taken).toBe(true);
      /*
       * Whether she arrived, and nothing more. No timestamp travels with the
       * roster: when somebody turned up is a fact about a person, and the screen
       * that reads this only needs to know the place is gone.
       */
      expect(Object.keys(ana ?? {}).sort()).toEqual(['displayName', 'participantId', 'taken']);
    });
    And('the places still open are marked as open', () => {
      const places = response.json().places as { displayName: string; taken: boolean }[];
      const open = places.filter((place) => !place.taken).map((place) => place.displayName);
      expect(open).toContain('María');
      expect(open).toContain('Pau');
      expect(open).not.toContain('Ana');
    });
  });

  Scenario('A contest with no place left still names its roster', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let response: LightMyRequestResponse;

    Given('a live contest where every place has been taken', async () => {
      ({ app, db } = makeTestApp());
      publishLiveContest(db, 'TAPAS5');
      for (const id of ['maria', 'pau', 'ana', 'marcos']) {
        await app.inject({
          method: 'POST',
          url: '/contests/TAPAS5/claim',
          payload: { participantId: id },
        });
      }
    });
    When('someone looks up the contest by its join code', async () => {
      response = await app.inject({ method: 'GET', url: '/contests/TAPAS5/places' });
    });
    Then('the whole roster is returned, with every place marked as taken', () => {
      expect(response.statusCode).toBe(200);
      const places = response.json().places as { displayName: string; taken: boolean }[];
      // An empty list would be indistinguishable from the wrong contest.
      expect(places).toHaveLength(4);
      expect(places.every((place) => place.taken)).toBe(true);
    });
  });

  Scenario('A participant claims their place', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let response: LightMyRequestResponse;

    Given('a live contest that includes a place for "Ana"', () => {
      ({ app, db } = makeTestApp());
      publishLiveContest(db, 'TAPAS1');
    });
    When('a person claims "Ana"\'s place with the join code', async () => {
      response = await app.inject({
        method: 'POST',
        url: '/contests/TAPAS1/claim',
        payload: { participantId: 'ana' },
      });
    });
    Then('they are recognised as "Ana"', () => {
      expect(response.statusCode).toBe(201);
      expect(response.json().displayName).toBe('Ana');
    });
    And('they receive a token for that contest', () => {
      expect(
        response.cookies.some((cookie) => cookie.name === 'voter_token' && cookie.value !== ''),
      ).toBe(true);
    });
  });

  Scenario('A place already taken cannot be claimed again', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let response: LightMyRequestResponse;

    Given('a live contest where "Ana"\'s place is already taken', () => {
      ({ app, db } = makeTestApp());
      publishLiveContest(db, 'TAPAS1');
      claimDirectly(db, 'TAPAS1', 'ana');
    });
    When('another person tries to claim "Ana"\'s place', async () => {
      response = await app.inject({
        method: 'POST',
        url: '/contests/TAPAS1/claim',
        payload: { participantId: 'ana' },
      });
    });
    Then('the claim is refused because that place is taken', () => {
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('PLACE_TAKEN');
    });
  });

  Scenario('A place that is not on the list cannot be claimed', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let response: LightMyRequestResponse;

    Given('a live contest that has no place for "Zoe"', () => {
      ({ app, db } = makeTestApp());
      publishLiveContest(db, 'TAPAS1');
    });
    When('a person tries to claim "Zoe"\'s place with the join code', async () => {
      response = await app.inject({
        method: 'POST',
        url: '/contests/TAPAS1/claim',
        payload: { participantId: 'zoe' },
      });
    });
    Then('the claim is refused because there is no such place', () => {
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('NO_SUCH_PLACE');
    });
  });

  Scenario('An unknown join code is refused', ({ Given, When, Then }) => {
    let app: FastifyInstance;

    Given('no contest has the join code "GHOST1"', () => {
      ({ app } = makeTestApp());
    });
    When('someone looks up the contest by code "GHOST1"', async () => {
      // asserted in Then
    });
    Then('the lookup is refused because the code is unknown', async () => {
      const response = await app.inject({ method: 'GET', url: '/contests/GHOST1/places' });
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('JOIN_CODE_NOT_FOUND');
    });
  });

  Scenario('A returning participant is recognised by their token', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let contestId: string;
    let cookie: string;
    let response: LightMyRequestResponse;

    Given('a person who has claimed "Ana"\'s place in a live contest', () => {
      ({ app, db } = makeTestApp());
      contestId = publishLiveContest(db, 'TAPAS1');
      cookie = claimDirectly(db, 'TAPAS1', 'ana');
    });
    When('they return to that contest with their token, no code given', async () => {
      response = await app.inject({
        method: 'GET',
        url: `/contests/${contestId}/me`,
        headers: { cookie },
      });
    });
    Then('they are recognised as "Ana"', () => {
      expect(response.statusCode).toBe(200);
      expect(response.json().displayName).toBe('Ana');
    });
  });

  Scenario("A participant's token does not grant host access", ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let cookie: string;
    let response: LightMyRequestResponse;

    Given('a person who has claimed a place in a live contest', () => {
      ({ app, db } = makeTestApp());
      publishLiveContest(db, 'TAPAS1');
      cookie = claimDirectly(db, 'TAPAS1', 'ana');
    });
    When('they try to do a host-only action using their token', async () => {
      response = await app.inject({
        method: 'POST',
        url: '/drafts',
        headers: { cookie },
        payload: { name: 'Sneaky Draft' },
      });
    });
    Then('access is refused because a voter may not do that', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });
});
