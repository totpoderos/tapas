import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp, seedHost } from '../support/test-server.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./deleting-a-contest.feature', import.meta.url)),
);

const STRONG_PASSWORD = 'Str0ng!Passw0rd';
const CONTEST_NAME = 'Summer Tapas';

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
  options: {
    method: 'GET' | 'POST' | 'DELETE';
    url: string;
    payload?: object;
    headers?: Record<string, string>;
  },
): Promise<LightMyRequestResponse> {
  const response = await app.inject({
    ...options,
    headers: { cookie: jar.header(), ...options.headers },
  });
  jar.capture(response);
  return response;
}

function content(): DraftContent {
  return {
    name: CONTEST_NAME,
    format: 'solo',
    closeRule: { when: 'host_trigger' },
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
  const payload = { email, password: STRONG_PASSWORD };
  await seedHost(app, payload.email, payload.password);
  await request(app, jar, { method: 'POST', url: '/auth/login', payload });
  return jar;
}

/** A saved draft, not yet published. */
async function draftFor(app: FastifyInstance, host: CookieJar): Promise<string> {
  const created = await request(app, host, { method: 'POST', url: '/drafts', payload: content() });
  return created.json().id as string;
}

interface Played {
  contestId: string;
  joinCode: string;
  host: CookieJar;
  ana: CookieJar;
}

/**
 * Publishes a contest, has Ana and Bob claim, enter dishes and score each other,
 * and (unless told otherwise) send their votes — so places are claimed and votes
 * cast, which is what makes the typed-name confirmation apply.
 */
async function playContest(
  app: FastifyInstance,
  opts: { close?: boolean; reveal?: boolean; send?: boolean; hostEmail?: string } = {},
): Promise<Played> {
  const host = await signIn(app, opts.hostEmail ?? 'h@x.es');
  const draftId = await draftFor(app, host);
  const published = await request(app, host, {
    method: 'POST',
    url: `/drafts/${draftId}/publish`,
  });
  const contestId = published.json().id as string;
  const joinCode = published.json().joinCode as string;

  const jars: Record<string, CookieJar> = {};
  for (const person of ['ana', 'bob']) {
    const jar = new CookieJar();
    await request(app, jar, {
      method: 'POST',
      url: `/contests/${joinCode}/claim`,
      payload: { participantId: person },
    });
    await request(app, jar, {
      method: 'POST',
      url: `/contests/${contestId}/dishes`,
      payload: { name: `${person} dish` },
    });
    jars[person] = jar;
  }
  await request(app, jars.ana!, {
    method: 'POST',
    url: `/contests/${contestId}/scores`,
    payload: { dishId: 'D-bob', categoryId: 'taste', value: 5 },
  });
  await request(app, jars.bob!, {
    method: 'POST',
    url: `/contests/${contestId}/scores`,
    payload: { dishId: 'D-ana', categoryId: 'taste', value: 3 },
  });
  if (opts.send !== false) {
    await request(app, jars.ana!, { method: 'POST', url: `/contests/${contestId}/send-vote` });
    await request(app, jars.bob!, { method: 'POST', url: `/contests/${contestId}/send-vote` });
  }
  if (opts.close) await request(app, host, { method: 'POST', url: `/contests/${contestId}/close` });
  if (opts.reveal)
    await request(app, host, { method: 'POST', url: `/contests/${contestId}/reveal` });

  return { contestId, joinCode, host, ana: jars.ana! };
}

/**
 * The live database behind the app under test. The tombstone assertions read the
 * audit log directly rather than through the API, because after a deletion there
 * is deliberately no way to read it back — the contest whose ownership the audit
 * route checks no longer exists.
 */
const state: { db: DatabaseSync } = { db: undefined as unknown as DatabaseSync };

async function freshApp(): Promise<FastifyInstance> {
  const made = await makeTestApp();
  state.db = made.db;
  return made.app;
}

interface AuditRow {
  type: string;
  actor_id: string;
  before_json: string | null;
  after_json: string | null;
  confirmation: string | null;
  occurred_at: string;
}

function tombstoneRows(contestId: string): AuditRow[] {
  return state.db
    .prepare('SELECT * FROM audit_log WHERE contest_id = ? ORDER BY occurred_at, id')
    .all(contestId) as unknown as AuditRow[];
}

const deleteUrl = (id: string, name?: string) =>
  name === undefined ? `/contests/${id}` : `/contests/${id}?confirm=${encodeURIComponent(name)}`;

/**
 * A host deleting through the app. It carries `x-tapas-confirmation: host` — the
 * same marker the host client sends for closing and revealing — because the host
 * accepted a confirmation before this request was made, and the audit entry
 * records that rather than assuming it.
 */
function deleteContest(
  app: FastifyInstance,
  jar: CookieJar,
  id: string,
  name?: string,
): Promise<LightMyRequestResponse> {
  return request(app, jar, {
    method: 'DELETE',
    url: deleteUrl(id, name),
    headers: { 'x-tapas-confirmation': 'host' },
  });
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('A host deletes a contest that has not started', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let host: CookieJar;
    let draftId: string;

    Given('a host with a contest they are still preparing', async () => {
      app = await freshApp();
      host = await signIn(app, 'h@x.es');
      draftId = await draftFor(app, host);
    });
    When('they delete it', async () => {
      const deleted = await deleteContest(app, host, draftId);
      expect(deleted.statusCode).toBe(204);
    });
    Then('it is gone from their contests', async () => {
      const list = await request(app, host, { method: 'GET', url: '/contests' });
      expect(list.json()).toHaveLength(0);
    });
    And('asking for it again finds nothing', async () => {
      const again = await request(app, host, { method: 'GET', url: `/drafts/${draftId}` });
      expect(again.statusCode).toBe(404);
    });
  });

  Scenario('A host deletes a contest that is running', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let played: Played;

    Given('a running contest with places claimed, dishes entered and votes cast', async () => {
      app = await freshApp();
      played = await playContest(app);
    });
    When('its host deletes it, reproducing its name', async () => {
      const deleted = await deleteContest(app, played.host, played.contestId, CONTEST_NAME);
      expect(deleted.statusCode).toBe(204);
    });
    Then('the contest is gone', async () => {
      const gone = await request(app, played.host, {
        method: 'GET',
        url: `/contests/${played.contestId}`,
      });
      expect(gone.statusCode).toBe(404);
    });
    And('every dish, score and vote cast in it is gone too', () => {
      const { db } = state;
      const rows = (table: string) =>
        (
          db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as unknown as { n: number }
        ).n;
      expect(rows('dishes')).toBe(0);
      expect(rows('persons')).toBe(0);
      expect(rows('vote_sessions')).toBe(0);
      expect(rows('scores')).toBe(0);
    });
  });

  Scenario('A host deletes a contest whose results are out', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let played: Played;

    Given('a contest that has been fully voted, closed, and revealed', async () => {
      app = await freshApp();
      played = await playContest(app, { close: true, reveal: true });
    });
    When('its host deletes it, reproducing its name', async () => {
      const deleted = await deleteContest(app, played.host, played.contestId, CONTEST_NAME);
      expect(deleted.statusCode).toBe(204);
    });
    Then('the contest is gone', async () => {
      const gone = await request(app, played.host, {
        method: 'GET',
        url: `/contests/${played.contestId}`,
      });
      expect(gone.statusCode).toBe(404);
    });
    And('its results can no longer be read', async () => {
      const results = await request(app, played.host, {
        method: 'GET',
        url: `/contests/${played.contestId}/winners`,
      });
      expect(results.statusCode).toBe(404);
    });
  });

  Scenario('The join code is released', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let played: Played;
    let response: LightMyRequestResponse;

    Given('a running contest that a host has deleted', async () => {
      app = await freshApp();
      played = await playContest(app);
      await deleteContest(app, played.host, played.contestId, CONTEST_NAME);
    });
    When('someone tries to join with the code it was using', async () => {
      response = await app.inject({ method: 'GET', url: `/contests/${played.joinCode}/places` });
    });
    Then('they are told there is no such contest', () => {
      expect(response.statusCode).toBe(404);
    });
  });

  Scenario("A host cannot delete another host's contest", ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let played: Played;
    let response: LightMyRequestResponse;

    Given('a contest belonging to another host', async () => {
      app = await freshApp();
      played = await playContest(app);
    });
    When('a host tries to delete it', async () => {
      const other = await signIn(app, 'other@x.es');
      response = await deleteContest(app, other, played.contestId, CONTEST_NAME);
    });
    Then('it is refused as not allowed', () => {
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('NOT_ALLOWED');
    });
    And('that contest is untouched', async () => {
      const still = await request(app, played.host, {
        method: 'GET',
        url: `/contests/${played.contestId}`,
      });
      expect(still.statusCode).toBe(200);
    });
  });

  Scenario('Deleting requires being signed in', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let played: Played;
    let response: LightMyRequestResponse;

    Given('a contest', async () => {
      app = await freshApp();
      played = await playContest(app);
    });
    When('it is deleted with nobody signed in', async () => {
      response = await app.inject({
        method: 'DELETE',
        url: deleteUrl(played.contestId, CONTEST_NAME),
      });
    });
    Then('it is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });

  Scenario('Deleting the same contest twice', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let played: Played;
    let response: LightMyRequestResponse;

    Given('a contest its host has already deleted', async () => {
      app = await freshApp();
      played = await playContest(app);
      const first = await deleteContest(app, played.host, played.contestId, CONTEST_NAME);
      expect(first.statusCode).toBe(204);
    });
    When('they delete it again', async () => {
      response = await deleteContest(app, played.host, played.contestId, CONTEST_NAME);
    });
    Then('they are told there is no such contest', () => {
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('CONTEST_NOT_FOUND');
    });
  });

  Scenario('The recorded history is erased with the contest', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let played: Played;

    Given('a contest that was prepared, published and closed', async () => {
      app = await freshApp();
      played = await playContest(app, { close: true });
      // It really does have a history to lose.
      const log = await request(app, played.host, {
        method: 'GET',
        url: `/contests/${played.contestId}/audit`,
      });
      expect(log.json().length).toBeGreaterThan(1);
    });
    When('its host deletes it, reproducing its name', async () => {
      await deleteContest(app, played.host, played.contestId, CONTEST_NAME);
    });
    Then('none of that recorded history remains', () => {
      const kinds = tombstoneRows(played.contestId).map((row) => row.type);
      expect(kinds).toEqual(['contest.deleted']);
    });
  });

  Scenario('The deletion itself is recorded', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let host: CookieJar;
    let draftId: string;

    Given('a host with a contest they are still preparing', async () => {
      app = await freshApp();
      host = await signIn(app, 'h@x.es');
      draftId = await draftFor(app, host);
    });
    When('they delete it', async () => {
      await deleteContest(app, host, draftId);
    });
    Then(
      'a single entry records that this host deleted this contest, and that they confirmed it',
      () => {
        const rows = tombstoneRows(draftId);
        expect(rows).toHaveLength(1);
        expect(rows[0]!.type).toBe('contest.deleted');
        expect(rows[0]!.confirmation).toBe('host');
        expect(rows[0]!.actor_id).toBeTruthy();
        expect(rows[0]!.occurred_at).toBeTruthy();
      },
    );
  });

  Scenario('The record left behind carries no personal detail', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let played: Played;

    Given('a running contest with named participants and dishes entered', async () => {
      app = await freshApp();
      played = await playContest(app);
    });
    When('its host deletes it, reproducing its name', async () => {
      await deleteContest(app, played.host, played.contestId, CONTEST_NAME);
    });
    Then('the entry left behind names none of them', () => {
      const rows = tombstoneRows(played.contestId);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.before_json).toBeNull();
      expect(rows[0]!.after_json).toBeNull();
      // Belt and braces: no participant or dish name anywhere in the whole row.
      const whole = JSON.stringify(rows[0]);
      for (const name of ['Ana', 'Bob', 'ana dish', 'bob dish']) {
        expect(whole).not.toContain(name);
      }
    });
  });

  Scenario("A deleted contest's history cannot be read back", ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let played: Played;
    let response: LightMyRequestResponse;

    Given('a contest its host has already deleted', async () => {
      app = await freshApp();
      played = await playContest(app);
      await deleteContest(app, played.host, played.contestId, CONTEST_NAME);
    });
    When('they ask to read its history', async () => {
      response = await request(app, played.host, {
        method: 'GET',
        url: `/contests/${played.contestId}/audit`,
      });
    });
    Then('they are told there is no such contest', () => {
      expect(response.statusCode).toBe(404);
    });
  });

  Scenario(
    'Deleting a contest people are taking part in demands its name',
    ({ Given, When, Then, And }) => {
      let app: FastifyInstance;
      let played: Played;
      let response: LightMyRequestResponse;

      Given('a running contest with places claimed', async () => {
        app = await freshApp();
        played = await playContest(app, { send: false });
      });
      When('its host tries to delete it without reproducing its name', async () => {
        response = await deleteContest(app, played.host, played.contestId);
      });
      Then('it is refused', () => {
        expect(response.statusCode).toBe(428);
        expect(response.json().error.code).toBe('CONFIRMATION_REQUIRED');
      });
      And('the contest is untouched', async () => {
        const still = await request(app, played.host, {
          method: 'GET',
          url: `/contests/${played.contestId}`,
        });
        expect(still.statusCode).toBe(200);
      });
    },
  );

  Scenario('The wrong name does not delete', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let played: Played;
    let response: LightMyRequestResponse;

    Given('a running contest with places claimed', async () => {
      app = await freshApp();
      played = await playContest(app, { send: false });
    });
    When('its host tries to delete it giving the wrong name', async () => {
      response = await deleteContest(app, played.host, played.contestId, 'Summer Tapa');
    });
    Then('it is refused', () => {
      expect(response.statusCode).toBe(428);
    });
    And('the contest is untouched', async () => {
      const still = await request(app, played.host, {
        method: 'GET',
        url: `/contests/${played.contestId}`,
      });
      expect(still.statusCode).toBe(200);
    });
  });

  Scenario('A participant cannot act on a deleted contest', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let played: Played;
    let response: LightMyRequestResponse;

    Given('a running contest that a participant was voting in', async () => {
      app = await freshApp();
      played = await playContest(app, { send: false });
    });
    When('its host deletes it and the participant tries to send their vote', async () => {
      await deleteContest(app, played.host, played.contestId, CONTEST_NAME);
      response = await request(app, played.ana, {
        method: 'POST',
        url: `/contests/${played.contestId}/send-vote`,
      });
    });
    Then('it is refused', () => {
      expect(response.statusCode).toBe(410);
      expect(response.json().error.code).toBe('CONTEST_DELETED');
    });
    And('no vote is recorded', () => {
      const { db } = state;
      const rows = (
        db.prepare('SELECT COUNT(*) AS n FROM vote_sessions').get() as unknown as { n: number }
      ).n;
      expect(rows).toBe(0);
    });
  });

  Scenario(
    'A participant is told the contest is gone rather than that it never existed',
    ({ Given, When, Then }) => {
      let app: FastifyInstance;
      let played: Played;
      let response: LightMyRequestResponse;

      Given('a running contest that a participant was voting in', async () => {
        app = await freshApp();
        played = await playContest(app, { send: false });
      });
      When('its host deletes it and the participant looks for the results', async () => {
        await deleteContest(app, played.host, played.contestId, CONTEST_NAME);
        response = await request(app, played.ana, {
          method: 'GET',
          url: `/contests/${played.contestId}/reveal`,
        });
      });
      Then('they are told the contest is gone', () => {
        expect(response.statusCode).toBe(410);
        expect(response.json().error.code).toBe('CONTEST_DELETED');
      });
    },
  );
});
