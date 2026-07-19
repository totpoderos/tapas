import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import type { DraftContent } from '@tapas/domain';
import { expect } from 'vitest';
import { makeTestApp } from '../support/test-server.js';
import {
  AuditRecorder,
  CreateDraft,
  createAuditProjection,
  PublishContest,
  SqliteAuditLogRepository,
  SqliteContestRepository,
  SqliteDraftRepository,
  type Clock,
} from '../../src/index.js';

const feature = await loadFeature(fileURLToPath(new URL('./voter-join.feature', import.meta.url)));

const CLOCK: Clock = { now: () => '2026-07-19T10:00:00.000Z' };

function person(id: string, partnerId: string) {
  return { id, displayName: id, partnerId };
}

/** A complete, publishable draft: 4 people in 2 couples, per person, couples barred. */
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
    participants: [person('A', 'B'), person('B', 'A'), person('C', 'D'), person('D', 'C')],
  };
}

/** Publishes a live contest directly against the app's own database — no publish HTTP endpoint exists yet. */
function publishLiveContest(db: DatabaseSync, name: string, joinCode: string): string {
  const drafts = new SqliteDraftRepository(db);
  const contests = new SqliteContestRepository(db);
  const auditLog = new SqliteAuditLogRepository(db);
  let auditSequence = 0;
  const ids = { next: () => `audit-${joinCode}-${++auditSequence}` };
  const audit = new AuditRecorder(auditLog, createAuditProjection({ clock: CLOCK, ids }));
  const joinCodes = { next: () => joinCode };

  const createDraft = new CreateDraft({ drafts, audit, clock: CLOCK, ids });
  const publishContest = new PublishContest({ drafts, contests, audit, clock: CLOCK, joinCodes });

  const created = createDraft.execute('host-1', completeContent(name));
  if (!created.ok) throw new Error('expected draft creation to succeed');
  const published = publishContest.execute(created.draft.id, 'host-1');
  if (!published.ok) throw new Error('expected publish to succeed');
  return published.contest.id;
}

async function request(
  app: FastifyInstance,
  cookie: string,
  options: { method: 'GET' | 'POST'; url: string; payload?: Record<string, unknown> },
): Promise<LightMyRequestResponse> {
  return app.inject({ ...options, headers: { cookie } });
}

function voterCookie(response: LightMyRequestResponse): string {
  const voterToken = response.cookies.find((c) => c.name === 'voter_token');
  return voterToken ? `voter_token=${voterToken.value}` : '';
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('A participant joins a live contest with a valid code', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let response: LightMyRequestResponse;

    Given('a live contest with join code "TAPAS1"', () => {
      ({ app, db } = makeTestApp());
      publishLiveContest(db, 'Tapas Night', 'TAPAS1');
    });
    When('a participant joins with that code and the display name "Marcos"', async () => {
      response = await request(app, '', {
        method: 'POST',
        url: '/contests/TAPAS1/join',
        payload: { displayName: 'Marcos' },
      });
    });
    Then('the join succeeds', () => {
      expect(response.statusCode).toBe(201);
    });
    And('the participant receives a token for that contest', () => {
      expect(voterCookie(response)).toContain('voter_token=');
    });
  });

  Scenario('Joining with an unknown code is refused', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let response: LightMyRequestResponse;

    Given('no contest has the join code "GHOST1"', () => {
      ({ app } = makeTestApp());
    });
    When(
      'a participant tries to join with code "GHOST1" and the display name "Marcos"',
      async () => {
        response = await request(app, '', {
          method: 'POST',
          url: '/contests/GHOST1/join',
          payload: { displayName: 'Marcos' },
        });
      },
    );
    Then('the join is refused because the code is unknown', () => {
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('JOIN_CODE_NOT_FOUND');
    });
  });

  Scenario(
    'A returning participant is recognised by their token, without the code',
    ({ Given, When, Then }) => {
      let app: FastifyInstance;
      let db: DatabaseSync;
      let contestId: string;
      let cookie: string;
      let response: LightMyRequestResponse;

      Given('a participant who already joined a live contest as "Marcos"', async () => {
        ({ app, db } = makeTestApp());
        contestId = publishLiveContest(db, 'Tapas Night', 'TAPAS1');
        const joined = await request(app, '', {
          method: 'POST',
          url: '/contests/TAPAS1/join',
          payload: { displayName: 'Marcos' },
        });
        cookie = voterCookie(joined);
      });
      When('they return to that contest with their token, no code given', async () => {
        response = await request(app, cookie, { method: 'GET', url: `/contests/${contestId}/me` });
      });
      Then('they are recognised as "Marcos" without rejoining', () => {
        expect(response.statusCode).toBe(200);
        expect(response.json().displayName).toBe('Marcos');
      });
    },
  );

  Scenario(
    "A participant's token does not grant access to a different contest",
    ({ Given, And, When, Then }) => {
      let app: FastifyInstance;
      let db: DatabaseSync;
      let otherContestId: string;
      let cookie: string;
      let response: LightMyRequestResponse;

      Given('a participant who joined one live contest as "Marcos"', async () => {
        ({ app, db } = makeTestApp());
        publishLiveContest(db, 'Tapas Night', 'TAPAS1');
        const joined = await request(app, '', {
          method: 'POST',
          url: '/contests/TAPAS1/join',
          payload: { displayName: 'Marcos' },
        });
        cookie = voterCookie(joined);
      });
      And('a second, unrelated live contest', () => {
        otherContestId = publishLiveContest(db, 'Other Tapas Night', 'TAPAS2');
      });
      When('they try to use their token on the second contest', async () => {
        response = await request(app, cookie, {
          method: 'GET',
          url: `/contests/${otherContestId}/me`,
        });
      });
      Then('access is refused because the token is not for that contest', () => {
        expect(response.statusCode).toBe(403);
        expect(response.json().error.code).toBe('NOT_ALLOWED');
      });
    },
  );

  Scenario("A participant's token does not grant host access", ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let cookie: string;
    let response: LightMyRequestResponse;

    Given('a participant who joined a live contest as "Marcos"', async () => {
      const testApp = makeTestApp();
      app = testApp.app;
      publishLiveContest(testApp.db, 'Tapas Night', 'TAPAS1');
      const joined = await request(app, '', {
        method: 'POST',
        url: '/contests/TAPAS1/join',
        payload: { displayName: 'Marcos' },
      });
      cookie = voterCookie(joined);
    });
    When('they try to do a host-only action on that contest using their token', async () => {
      response = await request(app, cookie, {
        method: 'POST',
        url: '/drafts',
        payload: { name: 'Sneaky Draft' },
      });
    });
    Then('access is refused because a voter may not do that', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });
});
