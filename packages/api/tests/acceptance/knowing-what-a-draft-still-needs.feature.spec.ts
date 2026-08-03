import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp, seedHost } from '../support/test-server.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./knowing-what-a-draft-still-needs.feature', import.meta.url)),
);

const STRONG_PASSWORD = 'Str0ng!Passw0rd';

/** A draft with nothing left to say: what kind it is, who is in it, how it is scored. */
function completeDraft(name: string): DraftContent {
  return {
    name,
    format: 'solo',
    scoring: {
      categories: [{ id: 'c1', name: 'Taste' }],
      range: { type: 'fixed', min: 1, max: 5 },
      uniquePerCategory: false,
    },
    participants: [
      { id: 'a', displayName: 'Ana' },
      { id: 'b', displayName: 'Bob' },
    ],
  };
}

/** The same draft with one thing left unsaid — the reported bug, exactly. */
function withoutFormat(name: string): DraftContent {
  const { format: _unsaid, ...rest } = completeDraft(name);
  return rest;
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

async function req(
  app: FastifyInstance,
  jar: CookieJar,
  o: { method: 'GET' | 'POST'; url: string; payload?: object },
) {
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

async function saveDraft(app: FastifyInstance, jar: CookieJar, content: DraftContent) {
  return req(app, jar, { method: 'POST', url: '/drafts', payload: content });
}

function details(app: FastifyInstance, jar: CookieJar, name: string) {
  return req(app, jar, { method: 'GET', url: `/contests/details?name=${encodeURIComponent(name)}` });
}

/**
 * What the answer says the draft still needs, wherever the answer carries it.
 *
 * A draft comes back two ways — as details, and as the draft that was just
 * created — and a host reading either of them is asking the same question. The
 * scenarios say "the draft", so this reads it the way the host would.
 */
function stillNeeded(response: LightMyRequestResponse): readonly string[] {
  const body = response.json();
  return body.stillNeeded ?? body.details?.stillNeeded ?? [];
}

/** How publishing words each thing a draft can be short of. */
const SAID_AS: Record<string, string> = {
  format: 'what kind of contest it is',
  participants: 'who is taking part',
  scoring: 'how it is scored',
};

describeFeature(feature, ({ Scenario }) => {
  Scenario('A draft that has not said what kind of contest it is says so', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given(
      'a host preparing a draft named "Tapas Night" with Ana and Bob taking part and a "Taste" category, that has not said what kind of contest it is',
      async () => {
        ({ app } = await makeTestApp());
        jar = await signedInHost(app, 'ana@example.com');
        await saveDraft(app, jar, withoutFormat('Tapas Night'));
      },
    );
    When('the host asks for the details of "Tapas Night"', async () => {
      response = await details(app, jar, 'Tapas Night');
    });
    Then('the draft says it still needs what kind of contest it is', () => {
      expect(response.statusCode).toBe(200);
      expect(stillNeeded(response)).toEqual(['format']);
    });
  });

  Scenario('A draft short of more than one thing names each of them', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given(
      'a host preparing a draft named "Half-baked" that has said nothing about what kind of contest it is nor how it is scored',
      async () => {
        ({ app } = await makeTestApp());
        jar = await signedInHost(app, 'ana@example.com');
        await saveDraft(app, jar, {
          name: 'Half-baked',
          participants: [{ id: 'a', displayName: 'Ana' }],
        });
      },
    );
    When('the host asks for the details of "Half-baked"', async () => {
      response = await details(app, jar, 'Half-baked');
    });
    Then('the draft says it still needs what kind of contest it is', () => {
      expect(stillNeeded(response)).toContain('format');
    });
    And('the draft says it still needs how it is scored', () => {
      expect(stillNeeded(response)).toContain('scoring');
    });
  });

  Scenario('A draft that is ready to publish says nothing is needed', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a host preparing a complete draft named "Tapas Night"', async () => {
      ({ app } = await makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      await saveDraft(app, jar, completeDraft('Tapas Night'));
    });
    When('the host asks for the details of "Tapas Night"', async () => {
      response = await details(app, jar, 'Tapas Night');
    });
    Then('the draft says nothing is still needed', () => {
      expect(stillNeeded(response)).toEqual([]);
    });
  });

  Scenario('A live contest is never told what it still needs', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a host with a live contest named "Balcony Cook-off"', async () => {
      ({ app } = await makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      const created = await saveDraft(app, jar, completeDraft('Balcony Cook-off'));
      await req(app, jar, { method: 'POST', url: `/drafts/${created.json().id}/publish` });
    });
    When('the host asks for the details of "Balcony Cook-off"', async () => {
      response = await details(app, jar, 'Balcony Cook-off');
    });
    Then('the draft says nothing is still needed', () => {
      expect(response.json().details.status).toBe('live');
      expect(stillNeeded(response)).toEqual([]);
    });
  });

  Scenario('A draft just created says what it still needs', ({ When, Then, And }) => {
    let response: LightMyRequestResponse;

    When('a host creates a draft named "Tapas" and says nothing else about it', async () => {
      const { app } = await makeTestApp();
      const jar = await signedInHost(app, 'ana@example.com');
      response = await saveDraft(app, jar, { name: 'Tapas' });
    });
    Then('the draft says it still needs what kind of contest it is', () => {
      expect(response.statusCode).toBe(201);
      expect(stillNeeded(response)).toContain('format');
    });
    And('the draft says it still needs who is taking part', () => {
      expect(stillNeeded(response)).toContain('participants');
    });
    And('the draft says it still needs how it is scored', () => {
      expect(stillNeeded(response)).toContain('scoring');
    });
  });

  /*
   * The one scenario that stops the two halves drifting. What a draft reports it
   * still needs and what publishing turns it away for are the same judgement;
   * asked in two places, they would eventually answer differently, and a host
   * would be told a draft was ready and then refused.
   */
  Scenario('What a draft still needs is what publishing refuses it for', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let draftId: string;
    let said: readonly string[];
    let refusal: LightMyRequestResponse;

    Given(
      'a host preparing a draft named "Tapas Night" with Ana and Bob taking part and a "Taste" category, that has not said what kind of contest it is',
      async () => {
        ({ app } = await makeTestApp());
        jar = await signedInHost(app, 'ana@example.com');
        const created = await saveDraft(app, jar, withoutFormat('Tapas Night'));
        draftId = created.json().id as string;
        said = stillNeeded(await details(app, jar, 'Tapas Night'));
      },
    );
    When('the host tries to publish "Tapas Night"', async () => {
      refusal = await req(app, jar, { method: 'POST', url: `/drafts/${draftId}/publish` });
    });
    Then('publishing is refused for exactly what the draft said it still needed', () => {
      expect(refusal.statusCode).toBe(422);
      const message = refusal.json().error.message as string;
      expect(said.length).toBeGreaterThan(0);
      for (const [gap, phrase] of Object.entries(SAID_AS)) {
        expect(message.includes(phrase)).toBe(said.includes(gap));
      }
    });
  });
});
