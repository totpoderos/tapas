import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp } from '../support/test-server.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./managing-contests-over-the-api.feature', import.meta.url)),
);

const STRONG_PASSWORD = 'Str0ng!Passw0rd';

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

/** Carries `Set-Cookie` across `inject()` calls the way a browser's cookie jar would. */
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
  options: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; url: string; payload?: object },
): Promise<LightMyRequestResponse> {
  const response = await app.inject({ ...options, headers: { cookie: jar.header() } });
  jar.capture(response);
  return response;
}

async function signedInHost(app: FastifyInstance, email: string): Promise<CookieJar> {
  const jar = new CookieJar();
  await request(app, jar, {
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: STRONG_PASSWORD },
  });
  await request(app, jar, {
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: STRONG_PASSWORD },
  });
  return jar;
}

describeFeature(feature, ({ Scenario }) => {
  Scenario(
    'A host takes a contest from draft to live, and it can be joined',
    ({ Given, When, Then, And }) => {
      let app: FastifyInstance;
      let jar: CookieJar;
      let publishResponse: LightMyRequestResponse;

      Given('a signed-in host "ana@example.com"', async () => {
        ({ app } = makeTestApp());
        jar = await signedInHost(app, 'ana@example.com');
      });
      When('that host saves a complete draft and publishes it through the API', async () => {
        const created = await request(app, jar, {
          method: 'POST',
          url: '/drafts',
          payload: completeContent('Summer Tapas 2026'),
        });
        publishResponse = await request(app, jar, {
          method: 'POST',
          url: `/drafts/${created.json().id}/publish`,
        });
      });
      Then('a live contest with a join code exists', () => {
        expect(publishResponse.statusCode).toBe(201);
        expect(publishResponse.json().joinCode).toBeTruthy();
      });
      And('a participant can join that contest with the code', async () => {
        const joinCode = publishResponse.json().joinCode;
        // The roster was seeded from the draft's participants (ids A–D); claim one.
        const joined = await app.inject({
          method: 'POST',
          url: `/contests/${joinCode}/claim`,
          payload: { participantId: 'A' },
        });
        expect(joined.statusCode).toBe(201);
      });
    },
  );

  Scenario('A host sees only their own drafts through the API', ({ Given, And, When, Then }) => {
    let app: FastifyInstance;
    let anaJar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a signed-in host "ana@example.com" with a saved draft', async () => {
      ({ app } = makeTestApp());
      anaJar = await signedInHost(app, 'ana@example.com');
      await request(app, anaJar, {
        method: 'POST',
        url: '/drafts',
        payload: { name: "Ana's Tapas" },
      });
    });
    And('a second signed-in host "bob@example.com" with a saved draft', async () => {
      const bobJar = await signedInHost(app, 'bob@example.com');
      await request(app, bobJar, {
        method: 'POST',
        url: '/drafts',
        payload: { name: "Bob's Tapas" },
      });
    });
    When('"ana@example.com" lists their drafts through the API', async () => {
      response = await request(app, anaJar, { method: 'GET', url: '/drafts' });
    });
    Then('only "ana@example.com"\'s draft is listed', () => {
      expect(response.statusCode).toBe(200);
      const drafts = response.json();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].content.name).toBe("Ana's Tapas");
    });
  });

  Scenario('A host renames a draft through the API', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let draftId: string;

    Given(
      'a signed-in host "ana@example.com" with a saved draft named "Summer Tapas"',
      async () => {
        ({ app } = makeTestApp());
        jar = await signedInHost(app, 'ana@example.com');
        const created = await request(app, jar, {
          method: 'POST',
          url: '/drafts',
          payload: { name: 'Summer Tapas' },
        });
        draftId = created.json().id;
      },
    );
    When('that host renames the draft to "Summer Tapas Final" through the API', async () => {
      const renamed = await request(app, jar, {
        method: 'PATCH',
        url: `/drafts/${draftId}`,
        payload: { name: 'Summer Tapas Final' },
      });
      expect(renamed.statusCode).toBe(200);
    });
    Then('the stored draft is named "Summer Tapas Final"', async () => {
      const draft = await request(app, jar, { method: 'GET', url: `/drafts/${draftId}` });
      expect(draft.json().content.name).toBe('Summer Tapas Final');
    });
  });

  Scenario('A host discards a draft through the API', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let draftId: string;

    Given('a signed-in host "ana@example.com" with a saved draft', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      const created = await request(app, jar, {
        method: 'POST',
        url: '/drafts',
        payload: { name: 'Doomed Draft' },
      });
      draftId = created.json().id;
    });
    When('that host discards the draft through the API', async () => {
      const discarded = await request(app, jar, { method: 'DELETE', url: `/drafts/${draftId}` });
      expect(discarded.statusCode).toBe(204);
    });
    Then('the draft no longer appears among their drafts', async () => {
      const drafts = await request(app, jar, { method: 'GET', url: '/drafts' });
      expect(drafts.json()).toHaveLength(0);
    });
  });

  Scenario('A host reads their own published contest through the API', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let contestId: string;

    Given('a signed-in host "ana@example.com" who has published a contest', async () => {
      ({ app } = makeTestApp());
      jar = await signedInHost(app, 'ana@example.com');
      const created = await request(app, jar, {
        method: 'POST',
        url: '/drafts',
        payload: completeContent('Summer Tapas 2026'),
      });
      const published = await request(app, jar, {
        method: 'POST',
        url: `/drafts/${created.json().id}/publish`,
      });
      contestId = published.json().id;
    });
    When('that host reads the contest through the API', async () => {
      const contest = await request(app, jar, { method: 'GET', url: `/contests/${contestId}` });
      expect(contest.statusCode).toBe(200);
      expect(contest.json().name).toBe('Summer Tapas 2026');
    });
    Then("the contest's details are returned", () => {
      // asserted in the When step; the read succeeding is the observable outcome
      expect(contestId).toBeTruthy();
    });
  });

  Scenario(
    "A host cannot publish another host's draft through the API",
    ({ Given, And, When, Then }) => {
      let app: FastifyInstance;
      let anaJar: CookieJar;
      let bobJar: CookieJar;
      let draftId: string;
      let response: LightMyRequestResponse;

      Given('a signed-in host "ana@example.com" who owns a draft', async () => {
        ({ app } = makeTestApp());
        anaJar = await signedInHost(app, 'ana@example.com');
        const created = await request(app, anaJar, {
          method: 'POST',
          url: '/drafts',
          payload: completeContent('Summer Tapas 2026'),
        });
        draftId = created.json().id;
      });
      And('a second signed-in host "bob@example.com"', async () => {
        bobJar = await signedInHost(app, 'bob@example.com');
      });
      When('"bob@example.com" tries to publish that draft through the API', async () => {
        response = await request(app, bobJar, {
          method: 'POST',
          url: `/drafts/${draftId}/publish`,
        });
      });
      Then('the API refuses it as not allowed', () => {
        expect(response.statusCode).toBe(403);
        expect(response.json().error.code).toBe('NOT_ALLOWED');
      });
    },
  );

  Scenario('Publishing requires being signed in', ({ Given, And, When, Then }) => {
    let app: FastifyInstance;
    let draftId: string;
    let response: LightMyRequestResponse;

    Given('a draft exists', async () => {
      ({ app } = makeTestApp());
      const ownerJar = await signedInHost(app, 'ana@example.com');
      const created = await request(app, ownerJar, {
        method: 'POST',
        url: '/drafts',
        payload: completeContent('Summer Tapas 2026'),
      });
      draftId = created.json().id;
    });
    And('no one is signed in', () => {
      // the next request carries no cookies
    });
    When('publishing that draft is attempted through the API', async () => {
      response = await app.inject({ method: 'POST', url: `/drafts/${draftId}/publish` });
    });
    Then('the API refuses it as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });
});
