import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { LLMClient, LLMCompletion } from '@tapas/shared';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp } from '../support/test-server.js';

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
    attribution: 'per_person',
    antiBias: 'couples',
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
  options: { method: 'GET' | 'POST'; url: string; payload?: object },
): Promise<LightMyRequestResponse> {
  const response = await app.inject({ ...options, headers: { cookie: jar.header() } });
  jar.capture(response);
  return response;
}

async function signedInHost(app: FastifyInstance, email: string): Promise<CookieJar> {
  const jar = new CookieJar();
  await request(app, jar, { method: 'POST', url: '/auth/register', payload: { email, password: STRONG_PASSWORD } });
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
  confirmation?: 'host' | 'auto';
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('The history of a contest spans its whole life', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let log: Entry[];

    Given('a signed-in host who has published a contest and then closed it', async () => {
      ({ app } = makeTestApp());
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
        ({ app } = makeTestApp(undefined, {}, llm));
        jar = await signedInHost(app, 'ana@example.com');
        contestId = await liveContest(app, jar, 'Balcony Cook-off');
      });
      And('that host closes it through the assistant, confirming when asked', async () => {
        llm.next = { text: '', toolCalls: [{ name: 'close_contest', arguments: { contestId } }] };
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
      ({ app } = makeTestApp());
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
      ({ app } = makeTestApp());
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
});
