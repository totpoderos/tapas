import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { LLMClient, LLMCompletion } from '@tapas/shared';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp, seedHost } from '../support/test-server.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./reading-a-contest-audit-log.feature', import.meta.url)),
);

const STRONG_PASSWORD = 'Str0ng!Passw0rd';

class ScriptedLLMClient implements LLMClient {
  next: LLMCompletion = { text: '', toolCalls: [] };
  async complete(): Promise<LLMCompletion> {
    return this.next;
  }
}

function completeContent(name: string): DraftContent {
  const person = (id: string, partnerId: string) => ({ id, displayName: id, partnerId });
  return {
    name,
    format: 'solo_with_partners',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: true },
    participants: [person('A', 'B'), person('B', 'A'), person('C', 'D'), person('D', 'C')],
  };
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

async function request(
  app: FastifyInstance,
  jar: CookieJar,
  options: { method: 'GET' | 'POST' | 'PATCH'; url: string; payload?: object },
): Promise<LightMyRequestResponse> {
  const response = await app.inject({ ...options, headers: { cookie: jar.header() } });
  jar.capture(response);
  return response;
}

async function signedInHost(app: FastifyInstance, email: string): Promise<CookieJar> {
  const jar = new CookieJar();
  await seedHost(app, email, STRONG_PASSWORD);
  await request(app, jar, { method: 'POST', url: '/auth/login', payload: { email, password: STRONG_PASSWORD } });
  return jar;
}

async function liveContest(app: FastifyInstance, jar: CookieJar, name: string): Promise<string> {
  const created = await request(app, jar, { method: 'POST', url: '/drafts', payload: completeContent(name) });
  const published = await request(app, jar, { method: 'POST', url: `/drafts/${created.json().id}/publish` });
  return published.json().id;
}

interface Entry {
  type: string;
  actorId: string;
  occurredAt: string;
  sourcePath: 'form' | 'mcp' | 'system';
  toolName?: string;
  toolArgs?: unknown;
  confirmation?: 'host' | 'auto';
}

/** A draft, unpublished — what a rename acts on. */
async function draftFor(app: FastifyInstance, jar: CookieJar, name: string): Promise<string> {
  const created = await request(app, jar, {
    method: 'POST',
    url: '/drafts',
    payload: completeContent(name),
  });
  expect(created.statusCode).toBe(201);
  return created.json().id as string;
}

/**
 * Has the assistant rename a draft, the way a host asking it to would — naming
 * the draft as the host says it, since that is now the only way the assistant
 * addresses one.
 */
async function assistantRenames(
  app: FastifyInstance,
  jar: CookieJar,
  llm: ScriptedLLMClient,
  currentName: string,
  name: string,
): Promise<void> {
  llm.next = {
    text: '',
    toolCalls: [{ name: 'rename_contest', arguments: { contest: currentName, name } }],
  };
  const turn = await request(app, jar, {
    method: 'POST',
    url: '/assistant/messages',
    payload: { messages: [{ role: 'user', content: `call it ${name}` }] },
  });
  expect(turn.json().kind).toBe('result');
}

/**
 * Everything recorded against a draft, read the only way it can be: a draft has
 * no readable history until it becomes a contest, so it is published first. The
 * renames happened while it was still a draft, which is the only time a draft
 * can be renamed at all.
 */
async function historyOf(app: FastifyInstance, jar: CookieJar, draftId: string): Promise<Entry[]> {
  const published = await request(app, jar, { method: 'POST', url: `/drafts/${draftId}/publish` });
  expect(published.statusCode).toBe(201);
  const log = await request(app, jar, { method: 'GET', url: `/contests/${draftId}/audit` });
  expect(log.statusCode).toBe(200);
  return log.json() as Entry[];
}

/** The most recent rename recorded against a draft. */
async function lastRename(
  app: FastifyInstance,
  jar: CookieJar,
  draftId: string,
): Promise<Entry | undefined> {
  return (await historyOf(app, jar, draftId)).filter((e) => e.type === 'draft.updated').at(-1);
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('The history of a contest spans its whole life', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let log: Entry[];

    Given('a signed-in host who has published a contest and then closed it', async () => {
      ({ app } = await makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      const id = await liveContest(app, jar, 'Summer Tapas');
      await request(app, jar, { method: 'POST', url: `/contests/${id}/close` });
      const audit = await request(app, jar, { method: 'GET', url: `/contests/${id}/audit` });
      expect(audit.statusCode).toBe(200);
      log = audit.json();
    });
    When("that host reads the contest's audit log", () => {
      // read in the Given so the log is available to every Then
      expect(log.length).toBeGreaterThan(0);
    });
    Then('the log records that the contest was published', () => {
      expect(log.map((e) => e.type)).toContain('contest.published');
    });
    And('the log records that the contest was closed', () => {
      expect(log.map((e) => e.type)).toContain('contest.closed');
    });
    And('each entry names who acted and when', () => {
      for (const entry of log) {
        expect(entry.actorId).toBeTruthy();
        expect(entry.occurredAt).toBeTruthy();
      }
    });
  });

  Scenario(
    'A destructive action approved through the assistant is recorded as host-confirmed',
    ({ Given, And, When, Then }) => {
      let app: FastifyInstance;
      let jar: CookieJar;
      let llm: ScriptedLLMClient;
      let contestId: string;

      Given('a signed-in host with a running contest', async () => {
        llm = new ScriptedLLMClient();
        ({ app } = await makeTestApp(undefined, {}, llm));
        jar = await signedInHost(app, 'ana@example.com');
        contestId = await liveContest(app, jar, 'Balcony Cook-off');
      });
      And('that host closes it through the assistant, confirming when asked', async () => {
        llm.next = { text: '', toolCalls: [{ name: 'close_contest', arguments: { contest: 'Balcony Cook-off' } }] };
        const asked = await request(app, jar, {
          method: 'POST',
          url: '/assistant/messages',
          payload: { messages: [{ role: 'user', content: 'close my contest' }] },
        });
        const body = asked.json();
        expect(body.kind).toBe('confirm');
        const confirmed = await request(app, jar, {
          method: 'POST',
          url: '/assistant/messages',
          payload: { confirm: { action: body.action, args: body.args, confirmationToken: body.confirmationToken } },
        });
        expect(confirmed.json().kind).toBe('result');
      });
      When("that host reads the contest's audit log", () => {
        // asserted in the Then
      });
      Then('the closing is recorded as confirmed by the host', async () => {
        const audit = await request(app, jar, { method: 'GET', url: `/contests/${contestId}/audit` });
        const closed = (audit.json() as Entry[]).find((e) => e.type === 'contest.closed');
        expect(closed?.confirmation).toBe('host');
      });
    },
  );

  Scenario('A host cannot read another host\'s audit log', ({ Given, And, When, Then }) => {
    let app: FastifyInstance;
    let anaJar: CookieJar;
    let bobJar: CookieJar;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given('a signed-in host who has published a contest', async () => {
      ({ app } = await makeTestApp());
      anaJar = await signedInHost(app, 'ana@example.com');
      contestId = await liveContest(app, anaJar, 'Summer Tapas');
    });
    And('a second signed-in host', async () => {
      bobJar = await signedInHost(app, 'bob@example.com');
    });
    When("the second host tries to read the first host's contest audit log", async () => {
      response = await request(app, bobJar, { method: 'GET', url: `/contests/${contestId}/audit` });
    });
    Then('it is refused as not allowed', () => {
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('NOT_ALLOWED');
    });
  });

  Scenario('Reading the audit log requires being signed in', ({ Given, And, When, Then }) => {
    let app: FastifyInstance;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given('a contest exists', async () => {
      ({ app } = await makeTestApp());
      const ownerJar = await signedInHost(app, 'ana@example.com');
      contestId = await liveContest(app, ownerJar, 'Summer Tapas');
    });
    And('no one is signed in', () => {
      // the next request carries no cookies
    });
    When('its audit log is requested', async () => {
      response = await app.inject({ method: 'GET', url: `/contests/${contestId}/audit` });
    });
    Then('it is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });

  Scenario('A host takes the log away as a file', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let file: LightMyRequestResponse;
    let contestId: string;

    Given('a signed-in host who has published a contest and then closed it', async () => {
      ({ app } = await makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      const id = await liveContest(app, jar, 'Summer Tapas');
      await request(app, jar, { method: 'POST', url: `/contests/${id}/close` });
      contestId = id;
    });
    When('that host asks for the audit log as a file', async () => {
      file = await request(app, jar, {
        method: 'GET',
        url: `/contests/${contestId}/audit?format=csv`,
      });
      expect(file.statusCode).toBe(200);
      expect(file.headers['content-type']).toContain('text/csv');
    });
    Then('the file carries a row for the publishing and a row for the closing', () => {
      expect(file.body).toContain('contest.published');
      expect(file.body).toContain('contest.closed');
    });
    And('each row carries how it was triggered, who acted, and when', () => {
      const [heading, ...rows] = file.body.trimEnd().split('\r\n');
      expect(heading).toBe('event,source,actor,confirmed,when,details');
      expect(rows.length).toBeGreaterThan(1);
      for (const row of rows) {
        const [, source, actor, , when] = row.split(',');
        expect(source).toBeTruthy();
        expect(actor).toBeTruthy();
        expect(when).toBeTruthy();
      }
    });
    And('the file is named after the contest', () => {
      expect(file.headers['content-disposition']).toContain('Summer-Tapas-activity-log.csv');
    });
  });

  Scenario("A host cannot take away another host's log as a file", ({ Given, And, When, Then }) => {
    let app: FastifyInstance;
    let anaJar: CookieJar;
    let bobJar: CookieJar;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given('a signed-in host who has published a contest', async () => {
      ({ app } = await makeTestApp());
      anaJar = await signedInHost(app, 'ana@example.com');
      contestId = await liveContest(app, anaJar, 'Summer Tapas');
    });
    And('a second signed-in host', async () => {
      bobJar = await signedInHost(app, 'bob@example.com');
    });
    When("the second host asks for the first host's log as a file", async () => {
      response = await request(app, bobJar, {
        method: 'GET',
        url: `/contests/${contestId}/audit?format=csv`,
      });
    });
    Then('it is refused as not allowed', () => {
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('NOT_ALLOWED');
    });
    And("no part of that contest's history is written", () => {
      // Not a file with an error in it: nothing of the log leaves at all.
      expect(response.headers['content-type']).not.toContain('text/csv');
      expect(response.body).not.toContain('contest.published');
      expect(response.headers['content-disposition']).toBeUndefined();
    });
  });

  Scenario('Taking the log away requires being signed in', ({ Given, And, When, Then }) => {
    let app: FastifyInstance;
    let contestId: string;
    let response: LightMyRequestResponse;

    Given('a contest exists', async () => {
      ({ app } = await makeTestApp());
      const ownerJar = await signedInHost(app, 'ana@example.com');
      contestId = await liveContest(app, ownerJar, 'Summer Tapas');
    });
    And('no one is signed in', () => {
      // the next request carries no cookies
    });
    When('its audit log is asked for as a file', async () => {
      response = await app.inject({
        method: 'GET',
        url: `/contests/${contestId}/audit?format=csv`,
      });
    });
    Then('it is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });

  Scenario('The file and the screen cannot drift apart', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let contestId: string;
    let onScreen: Entry[];
    let file: LightMyRequestResponse;

    Given('a signed-in host who has published a contest and then closed it', async () => {
      ({ app } = await makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      contestId = await liveContest(app, jar, 'Summer Tapas');
      await request(app, jar, { method: 'POST', url: `/contests/${contestId}/close` });
    });
    When('that host reads the log on screen and asks for it as a file', async () => {
      const screen = await request(app, jar, { method: 'GET', url: `/contests/${contestId}/audit` });
      onScreen = screen.json();
      file = await request(app, jar, {
        method: 'GET',
        url: `/contests/${contestId}/audit?format=csv`,
      });
      expect(file.statusCode).toBe(200);
    });
    Then('the file has exactly one row per recorded action', () => {
      const rows = file.body.trimEnd().split('\r\n').slice(1);
      expect(rows).toHaveLength(onScreen.length);
    });
    And('the rows say the same actions, in the same order, as the screen', () => {
      /*
       * The point of building the file from the projection rather than from
       * what a screen happens to be holding: one read, one order, no chance of
       * the two answering the same question differently.
       */
      const rows = file.body.trimEnd().split('\r\n').slice(1);
      expect(rows.map((row) => row.split(',')[0])).toEqual(onScreen.map((entry) => entry.type));
    });
  });

  /*
   * Provenance. The assistant runs a tool by dispatching an ordinary request
   * back through this same API, so these drive the real assistant and then read
   * the real log — a unit test of the plumbing would not have caught that the
   * plumbing was never connected.
   */
  Scenario("An assistant renaming a draft is recorded as the assistant's work", ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let llm: ScriptedLLMClient;
    let draftId: string;
    let renamed: Entry | undefined;

    Given('a signed-in host with a draft', async () => {
      llm = new ScriptedLLMClient();
      ({ app } = await makeTestApp(undefined, {}, llm));
      jar = await signedInHost(app, 'ana@example.com');
      draftId = await draftFor(app, jar, 'Summer Tapas');
    });
    When('that host asks the assistant to rename it', async () => {
      await assistantRenames(app, jar, llm, 'Summer Tapas', 'Autumn Tapas');
      renamed = await lastRename(app, jar, draftId);
    });
    Then('the renaming is recorded as having come through a connected tool', () => {
      expect(renamed?.sourcePath).toBe('mcp');
    });
    And('it names the tool that renamed it', () => {
      expect(renamed?.toolName).toBe('rename_contest');
    });
    And('the new name it was asked for is recorded with it', () => {
      expect(renamed?.toolArgs).toMatchObject({ name: 'Autumn Tapas' });
    });
  });

  Scenario("The same action taken in the app is recorded as the host's own", ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let draftId: string;
    let renamed: Entry | undefined;

    Given('a signed-in host with a draft', async () => {
      ({ app } = await makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      draftId = await draftFor(app, jar, 'Summer Tapas');
    });
    When('that host renames it in the app', async () => {
      const response = await request(app, jar, {
        method: 'PATCH',
        url: `/drafts/${draftId}`,
        payload: { name: 'Autumn Tapas' },
      });
      expect(response.statusCode).toBe(200);
      renamed = await lastRename(app, jar, draftId);
    });
    Then('the renaming is recorded as having come from the app', () => {
      expect(renamed?.sourcePath).toBe('form');
    });
    And('it names no tool', () => {
      expect(renamed?.toolName).toBeUndefined();
    });
  });

  Scenario('A host can tell the two apart in one history', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let llm: ScriptedLLMClient;
    let draftId: string;
    let renames: Entry[];

    Given('a signed-in host who has renamed a draft in the app and had the assistant rename it too', async () => {
      llm = new ScriptedLLMClient();
      ({ app } = await makeTestApp(undefined, {}, llm));
      jar = await signedInHost(app, 'ana@example.com');
      draftId = await draftFor(app, jar, 'Summer Tapas');
      await request(app, jar, {
        method: 'PATCH',
        url: `/drafts/${draftId}`,
        payload: { name: 'By hand' },
      });
      // The by-hand rename has already happened, so the draft the assistant is
      // asked for is the one the host would now say: "By hand", not the name it
      // was created with. Addressing by name means the name has to be current.
      await assistantRenames(app, jar, llm, 'By hand', 'By assistant');
    });
    When('that host reads the recorded history', async () => {
      renames = (await historyOf(app, jar, draftId)).filter((e) => e.type === 'draft.updated');
      expect(renames).toHaveLength(2);
    });
    Then('the two renamings are recorded with different sources', () => {
      expect(new Set(renames.map((e) => e.sourcePath)).size).toBe(2);
    });
    And("only the assistant's is left when the history is narrowed to a connected tool", () => {
      const throughATool = renames.filter((e) => e.sourcePath === 'mcp');
      expect(throughATool).toHaveLength(1);
      expect(throughATool[0]?.toolArgs).toMatchObject({ name: 'By assistant' });
    });
  });

  Scenario("An assistant's action is still the host's action", ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let llm: ScriptedLLMClient;
    let draftId: string;
    let hostId: string;
    let renamed: Entry | undefined;

    Given('a signed-in host who asked the assistant to rename a draft', async () => {
      llm = new ScriptedLLMClient();
      ({ app } = await makeTestApp(undefined, {}, llm));
      jar = await signedInHost(app, 'ana@example.com');
      const me = await request(app, jar, { method: 'GET', url: '/auth/me' });
      hostId = me.json().hostId;
      draftId = await draftFor(app, jar, 'Summer Tapas');
      await assistantRenames(app, jar, llm, 'Summer Tapas', 'Autumn Tapas');
    });
    When('that host reads the recorded history', async () => {
      renamed = await lastRename(app, jar, draftId);
    });
    Then('the renaming names the host as the actor', () => {
      /*
       * Provenance says how the action arrived, not who is answerable for it.
       * The assistant holds no identity and no authorization of its own.
       */
      expect(renamed?.actorId).toBe(hostId);
    });
  });

  Scenario('A destructive action through the assistant is both connected-tool and confirmed', ({ Given, And, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let llm: ScriptedLLMClient;
    let contestId: string;
    let closed: Entry | undefined;

    Given('a signed-in host with a running contest', async () => {
      llm = new ScriptedLLMClient();
      ({ app } = await makeTestApp(undefined, {}, llm));
      jar = await signedInHost(app, 'ana@example.com');
      contestId = await liveContest(app, jar, 'Balcony Cook-off');
    });
    And('that host closes it through the assistant, confirming when asked', async () => {
      llm.next = { text: '', toolCalls: [{ name: 'close_contest', arguments: { contest: 'Balcony Cook-off' } }] };
      const asked = await request(app, jar, {
        method: 'POST',
        url: '/assistant/messages',
        payload: { messages: [{ role: 'user', content: 'close my contest' }] },
      });
      const body = asked.json();
      expect(body.kind).toBe('confirm');
      const confirmed = await request(app, jar, {
        method: 'POST',
        url: '/assistant/messages',
        payload: { confirm: { action: body.action, args: body.args, confirmationToken: body.confirmationToken } },
      });
      expect(confirmed.json().kind).toBe('result');
    });
    When("that host reads the contest's audit log", async () => {
      const log = await request(app, jar, { method: 'GET', url: `/contests/${contestId}/audit` });
      closed = (log.json() as Entry[]).find((e) => e.type === 'contest.closed');
    });
    Then('the closing is recorded as having come through a connected tool', () => {
      expect(closed?.sourcePath).toBe('mcp');
    });
    And('it is still recorded as confirmed by the host', () => {
      // The new marking must not be bought at the cost of the old one.
      expect(closed?.confirmation).toBe('host');
    });
  });
});
