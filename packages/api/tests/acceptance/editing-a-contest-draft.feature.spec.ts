import { fileURLToPath } from 'node:url';
import type { DraftContent, Person } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { SqliteAuditLogRepository } from '../../src/index.js';
import { makeTestApp, seedHost } from '../support/test-server.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./editing-a-contest-draft.feature', import.meta.url)),
);

const STRONG_PASSWORD = 'Str0ng!Passw0rd';
const PID: Record<string, string> = { Ana: 'ana', Bob: 'bob', Carmen: 'carmen', Dan: 'dan' };

/** A draft's content, with optional overrides — only the name is required to save. */
function content(name: string, over: Partial<DraftContent> = {}): DraftContent {
  return {
    name,
    format: 'solo',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'fixed', min: 1, max: 5 }, uniquePerCategory: false },
    participants: [],
    ...over,
  };
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

async function req(app: FastifyInstance, jar: CookieJar, o: { method: 'GET' | 'POST' | 'PUT'; url: string; payload?: object }) {
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

async function createDraft(app: FastifyInstance, jar: CookieJar, c: DraftContent): Promise<string> {
  const created = await req(app, jar, { method: 'POST', url: '/drafts', payload: c });
  return created.json().id as string;
}

function editDraft(app: FastifyInstance, jar: CookieJar, id: string, c: DraftContent) {
  return req(app, jar, { method: 'PUT', url: `/drafts/${id}`, payload: c });
}

/** An edit sent as the wire would carry it, so the boundary can be asked to refuse it. */
function editDraftRaw(app: FastifyInstance, jar: CookieJar, id: string, payload: object) {
  return req(app, jar, { method: 'PUT', url: `/drafts/${id}`, payload });
}

function getDraft(app: FastifyInstance, jar: CookieJar, id: string) {
  return req(app, jar, { method: 'GET', url: `/drafts/${id}` });
}

describeFeature(feature, ({ Scenario }) => {
  Scenario("A host changes the contest's format", ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let id: string;

    Given('a host preparing a draft named "Tapas Night" where everyone is on their own', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      id = await createDraft(app, jar, content('Tapas Night', { format: 'solo' }));
    });
    When('the host revises the draft so that couples cook together', async () => {
      await editDraft(app, jar, id, content('Tapas Night', { format: 'couples' }));
    });
    Then('the draft is one where couples cook together', async () => {
      expect((await getDraft(app, jar, id)).json().content.format).toBe('couples');
    });
  });

  Scenario('A host changes the format back to one where nobody is kept apart', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let id: string;

    Given('a host preparing a draft named "Tapas Night" where everyone is on their own with partners kept apart', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      id = await createDraft(app, jar, content('Tapas Night', { format: 'solo_with_partners' }));
    });
    When('the host revises the draft so that everyone is on their own', async () => {
      await editDraft(app, jar, id, content('Tapas Night', { format: 'solo' }));
    });
    Then('the draft is one where everyone is on their own', async () => {
      expect((await getDraft(app, jar, id)).json().content.format).toBe('solo');
    });
  });

  Scenario('A format the contest cannot have is refused', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let id: string;
    let response: LightMyRequestResponse;

    Given('a host preparing a draft named "Tapas Night" where everyone is on their own', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      id = await createDraft(app, jar, content('Tapas Night', { format: 'solo' }));
    });
    When('the host tries to revise the draft to a format that is not one of the three', async () => {
      // Not reachable through the typed client, so sent as the wire would carry
      // it: the boundary has to refuse it, not the type system.
      response = await editDraftRaw(app, jar, id, {
        ...content('Tapas Night'),
        format: 'per_couple',
      });
    });
    Then('the revision is rejected because the format is not one the contest can have', () => {
      expect(response.statusCode).toBe(400);
    });
    And('the draft is still one where everyone is on their own', async () => {
      expect((await getDraft(app, jar, id)).json().content.format).toBe('solo');
    });
  });

  Scenario("A host changes their draft's scoring and participants", ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let jar: CookieJar;
    let id: string;

    Given('a host preparing a draft named "Tapas Night"', async () => {
      ({ app, db } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      id = await createDraft(app, jar, content('Tapas Night'));
    });
    When('the host revises the draft to be scored on "Presentation" and "Taste", with Ana, Bob and Carmen taking part', async () => {
      await editDraft(app, jar, id, content('Tapas Night', {
        scoring: {
          categories: [{ id: 'c1', name: 'Presentation' }, { id: 'c2', name: 'Taste' }],
          range: { type: 'fixed', min: 1, max: 5 },
          uniquePerCategory: false,
        },
        participants: people('Ana', 'Bob', 'Carmen'),
      }));
    });
    Then('the draft is scored on "Presentation" and "Taste"', async () => {
      const names = (await getDraft(app, jar, id)).json().content.scoring.categories.map((c: { name: string }) => c.name);
      expect(names).toEqual(['Presentation', 'Taste']);
    });
    And('Ana, Bob and Carmen are taking part', async () => {
      const names = (await getDraft(app, jar, id)).json().content.participants.map((p: { displayName: string }) => p.displayName);
      expect(names).toEqual(['Ana', 'Bob', 'Carmen']);
    });
    And('the audit log records the change to the draft', () => {
      const entries = new SqliteAuditLogRepository(db).findByContest(id);
      expect(entries.some((e) => e.type === 'draft.updated')).toBe(true);
    });
  });

  Scenario('A host removes a participant', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let id: string;

    Given('a host preparing a draft named "Tapas Night" with Ana, Bob and Carmen taking part', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      id = await createDraft(app, jar, content('Tapas Night', { participants: people('Ana', 'Bob', 'Carmen') }));
    });
    When('the host revises the draft to remove Carmen', async () => {
      await editDraft(app, jar, id, content('Tapas Night', { participants: people('Ana', 'Bob') }));
    });
    Then('only Ana and Bob are taking part', async () => {
      const names = (await getDraft(app, jar, id)).json().content.participants.map((p: { displayName: string }) => p.displayName);
      expect(names).toEqual(['Ana', 'Bob']);
    });
  });

  Scenario('A host pairs participants in their draft', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let id: string;

    Given('a host preparing a draft named "Tapas Night" with Ana, Bob, Carmen and Dan taking part', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      id = await createDraft(app, jar, content('Tapas Night', { participants: people('Ana', 'Bob', 'Carmen', 'Dan') }));
    });
    When('the host revises the draft so that Ana and Bob are partners, and Carmen and Dan are partners', async () => {
      await editDraft(app, jar, id, content('Tapas Night', {
        participants: [
          { id: 'ana', displayName: 'Ana', partnerId: 'bob' },
          { id: 'bob', displayName: 'Bob', partnerId: 'ana' },
          { id: 'carmen', displayName: 'Carmen', partnerId: 'dan' },
          { id: 'dan', displayName: 'Dan', partnerId: 'carmen' },
        ],
      }));
    });
    function partnerOf(participants: { id: string; partnerId?: string }[], id: string): string | undefined {
      return participants.find((p) => p.id === id)?.partnerId;
    }
    Then('Ana and Bob are recorded as partners', async () => {
      const ps = (await getDraft(app, jar, id)).json().content.participants;
      expect(partnerOf(ps, 'ana')).toBe('bob');
      expect(partnerOf(ps, 'bob')).toBe('ana');
    });
    And('Carmen and Dan are recorded as partners', async () => {
      const ps = (await getDraft(app, jar, id)).json().content.participants;
      expect(partnerOf(ps, 'carmen')).toBe('dan');
      expect(partnerOf(ps, 'dan')).toBe('carmen');
    });
  });

  Scenario('An edited draft still requires a name', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let id: string;
    let response: LightMyRequestResponse;

    Given('a host preparing a draft named "Tapas Night"', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      id = await createDraft(app, jar, content('Tapas Night'));
    });
    When('the host tries to revise the draft to have no name', async () => {
      response = await editDraft(app, jar, id, content(''));
    });
    Then('the revision is rejected because a name is required', () => {
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('NAME_REQUIRED');
    });
  });

  Scenario("A host cannot edit another host's draft", ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let anaJar: CookieJar;
    let bobDraftId: string;
    let response: LightMyRequestResponse;

    Given('a host, and a second host preparing a draft named "Their Draft"', async () => {
      ({ app } = makeTestApp());
      anaJar = await signedInHost(app, 'ana@example.com');
      const bobJar = await signedInHost(app, 'bob@example.com');
      bobDraftId = await createDraft(app, bobJar, content('Their Draft'));
    });
    When("the first host tries to revise the other host's draft", async () => {
      response = await editDraft(app, anaJar, bobDraftId, content('Hijacked'));
    });
    Then("the revision is refused and the other host's draft is unchanged", async () => {
      expect(response.statusCode).toBe(403);
      const bobJar = await signedInHost(app, 'bob@example.com');
      expect((await getDraft(app, bobJar, bobDraftId)).json().content.name).toBe('Their Draft');
    });
  });

  Scenario('Editing a draft requires being signed in', ({ When, Then }) => {
    let app: FastifyInstance;
    let response: LightMyRequestResponse;

    When('editing a draft is attempted with no one signed in', async () => {
      ({ app } = makeTestApp());
      response = await app.inject({ method: 'PUT', url: '/drafts/whatever', payload: content('X') });
    });
    Then('the request is refused as not authorized', () => {
      expect(response.statusCode).toBe(401);
    });
  });
});
