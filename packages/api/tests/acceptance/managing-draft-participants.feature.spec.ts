import { fileURLToPath } from 'node:url';
import type { DraftContent, Person } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { SqliteAuditLogRepository } from '../../src/index.js';
import { makeTestApp, seedHost } from '../support/test-server.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./managing-draft-participants.feature', import.meta.url)),
);

const STRONG_PASSWORD = 'Str0ng!Passw0rd';
const PID: Record<string, string> = { Ana: 'ana', Bob: 'bob', Carmen: 'carmen' };

function content(name: string, participants: Person[]): DraftContent {
  return { name, participants };
}
function people(...names: string[]): Person[] {
  return names.map((displayName) => ({ id: PID[displayName]!, displayName }));
}

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

async function req(app: FastifyInstance, jar: CookieJar, o: { method: 'GET' | 'POST' | 'DELETE'; url: string; payload?: object }) {
  const response = await app.inject({ ...o, headers: { cookie: jar.header() } });
  jar.capture(response);
  return response;
}

async function signedInHost(app: FastifyInstance, email: string): Promise<CookieJar> {
  const jar = new CookieJar();
  await seedHost(app, email, STRONG_PASSWORD);
  await req(app, jar, { method: 'POST', url: '/auth/login', payload: { email, password: STRONG_PASSWORD } });
  return jar;
}

async function saveDraft(app: FastifyInstance, jar: CookieJar, c: DraftContent): Promise<string> {
  return (await req(app, jar, { method: 'POST', url: '/drafts', payload: c })).json().id as string;
}
async function liveContest(app: FastifyInstance, jar: CookieJar, name: string): Promise<void> {
  const complete: DraftContent = {
    name,
    format: 'solo',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'fixed', min: 1, max: 5 }, uniquePerCategory: false },
    participants: people('Ana', 'Bob'),
  };
  const published = await req(app, jar, { method: 'POST', url: `/drafts/${await saveDraft(app, jar, complete)}/publish` });
  expect(published.statusCode).toBe(201); // the draft is retired only if publish actually succeeds
}
function addParticipant(app: FastifyInstance, jar: CookieJar, contest: string, participant: string) {
  return req(app, jar, { method: 'POST', url: '/drafts/participants', payload: { contest, participant } });
}
function removeParticipant(app: FastifyInstance, jar: CookieJar, contest: string, participant: string) {
  const q = `contest=${encodeURIComponent(contest)}&participant=${encodeURIComponent(participant)}`;
  return req(app, jar, { method: 'DELETE', url: `/drafts/participants?${q}` });
}
async function draftParticipants(app: FastifyInstance, jar: CookieJar, id: string): Promise<Person[]> {
  return (await req(app, jar, { method: 'GET', url: `/drafts/${id}` })).json().content.participants;
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('A host adds a participant to their draft by name', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let jar: CookieJar;
    let id: string;

    Given('a host preparing a draft named "Tapas Night" with Ana and Bob taking part', async () => {
      ({ app, db } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      id = await saveDraft(app, jar, content('Tapas Night', people('Ana', 'Bob')));
    });
    When('the host adds "Carmen" to "Tapas Night"', async () => {
      expect((await addParticipant(app, jar, 'Tapas Night', 'Carmen')).statusCode).toBe(200);
    });
    Then('Ana, Bob and Carmen are taking part in the draft', async () => {
      expect((await draftParticipants(app, jar, id)).map((p) => p.displayName)).toEqual(['Ana', 'Bob', 'Carmen']);
    });
    And('the audit log records the change', () => {
      expect(new SqliteAuditLogRepository(db).findByContest(id).some((e) => e.type === 'draft.updated')).toBe(true);
    });
  });

  Scenario('A host removes a participant from their draft by name', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let id: string;

    Given('a host preparing a draft named "Tapas Night" with Ana, Bob and Carmen taking part', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      id = await saveDraft(app, jar, content('Tapas Night', people('Ana', 'Bob', 'Carmen')));
    });
    When('the host removes "Carmen" from "Tapas Night"', async () => {
      await removeParticipant(app, jar, 'Tapas Night', 'Carmen');
    });
    Then('only Ana and Bob are taking part in the draft', async () => {
      expect((await draftParticipants(app, jar, id)).map((p) => p.displayName)).toEqual(['Ana', 'Bob']);
    });
  });

  Scenario('Removing a participant also clears their pairings', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let id: string;

    Given('a host preparing a draft named "Tapas Night" where Ana and Bob are a couple', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      id = await saveDraft(app, jar, content('Tapas Night', [
        { id: 'ana', displayName: 'Ana', partnerId: 'bob' },
        { id: 'bob', displayName: 'Bob', partnerId: 'ana' },
      ]));
    });
    When('the host removes "Bob" from "Tapas Night"', async () => {
      await removeParticipant(app, jar, 'Tapas Night', 'Bob');
    });
    Then('only Ana is taking part in the draft', async () => {
      expect((await draftParticipants(app, jar, id)).map((p) => p.displayName)).toEqual(['Ana']);
    });
    And('Ana is no longer paired with anyone', async () => {
      expect((await draftParticipants(app, jar, id)).find((p) => p.id === 'ana')?.partnerId).toBeUndefined();
    });
  });

  Scenario('When two drafts share a name, the host is offered the choice', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let firstId: string;
    let response: LightMyRequestResponse;

    Given('a host preparing two drafts both named "Tapas Night"', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      firstId = await saveDraft(app, jar, content('Tapas Night', people('Ana')));
      await saveDraft(app, jar, content('Tapas Night', people('Bob')));
    });
    When('the host adds "Carmen" to "Tapas Night"', async () => {
      response = await addParticipant(app, jar, 'Tapas Night', 'Carmen');
    });
    Then('the host is offered both drafts to choose from', () => {
      expect(response.json().details).toBeUndefined();
      expect(response.json().candidates).toHaveLength(2);
    });
    And('neither draft is changed', async () => {
      expect((await draftParticipants(app, jar, firstId)).map((p) => p.displayName)).toEqual(['Ana']);
    });
  });

  Scenario('A host cannot manage the participants of a published contest by name', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a host with a published contest named "Balcony Cook-off"', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      await liveContest(app, jar, 'Balcony Cook-off');
    });
    When('the host adds "Carmen" to "Balcony Cook-off"', async () => {
      response = await addParticipant(app, jar, 'Balcony Cook-off', 'Carmen');
    });
    Then('no draft is found to change', () => {
      expect(response.json().details).toBeUndefined();
      expect(response.json().candidates).toEqual([]);
    });
  });

  Scenario("A host cannot manage another host's draft participants", ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let anaJar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a host, and a second host preparing a draft named "Their Draft"', async () => {
      ({ app } = makeTestApp());
      anaJar = await signedInHost(app, 'ana@example.com');
      const bobJar = await signedInHost(app, 'bob@example.com');
      await saveDraft(app, bobJar, content('Their Draft', people('Bob')));
    });
    When('the first host adds "Carmen" to the other host\'s draft "Their Draft"', async () => {
      response = await addParticipant(app, anaJar, 'Their Draft', 'Carmen');
    });
    Then('no draft is found to change', () => {
      expect(response.json().candidates).toEqual([]);
    });
  });

  Scenario('Managing participants requires being signed in', ({ When, Then }) => {
    let app: FastifyInstance;
    let response: LightMyRequestResponse;

    When('adding a participant is attempted with no one signed in', async () => {
      ({ app } = makeTestApp());
      response = await app.inject({ method: 'POST', url: '/drafts/participants', payload: { contest: 'X', participant: 'Y' } });
    });
    Then('the request is refused as not authorized', () => {
      expect(response.statusCode).toBe(401);
    });
  });
});
