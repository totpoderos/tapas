import { fileURLToPath } from 'node:url';
import type { DraftContent } from '@tapas/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp, seedHost } from '../support/test-server.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./reading-the-link-that-joins.feature', import.meta.url)),
);

const STRONG_PASSWORD = 'Str0ng!Passw0rd';

function draftContent(name: string): DraftContent {
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
  await req(app, jar, {
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: STRONG_PASSWORD },
  });
  return jar;
}

/** A published contest, and the join code it was issued. */
async function liveContest(
  app: FastifyInstance,
  jar: CookieJar,
  name: string,
): Promise<{ id: string; joinCode: string }> {
  const created = await req(app, jar, {
    method: 'POST',
    url: '/drafts',
    payload: draftContent(name),
  });
  const published = await req(app, jar, {
    method: 'POST',
    url: `/drafts/${created.json().id as string}/publish`,
  });
  const body = published.json();
  return { id: body.id as string, joinCode: body.joinCode as string };
}

function read(app: FastifyInstance, jar: CookieJar, id: string) {
  return req(app, jar, { method: 'GET', url: `/contests/${id}` });
}

/**
 * Where the participant app answers, in the runner's own words.
 *
 * The feature says "the address where people join, carrying that contest's join
 * code" and stops there, because the deep link's shape is the participant app's
 * business and a spec that names it is a spec that breaks when it moves. The
 * runner is where that shape is allowed to be concrete.
 */
const joiningAt = (address: string, joinCode: string) => `${address}/j/${joinCode}`;

describeFeature(feature, ({ Background, Scenario }) => {
  /*
   * Set by the Background, and re-set by the scenarios that are about the address
   * itself. Each scenario builds its own app in a later step, so an override
   * lands before the app that reads it is ever created.
   */
  let address: string;

  Background(({ Given }) => {
    Given('people join contests at "https://join.sobremesa.es"', () => {
      address = 'https://join.sobremesa.es';
    });
  });

  Scenario(
    'A host reads their contest and is given the link that joins it',
    ({ Given, When, Then, And }) => {
      let app: FastifyInstance;
      let jar: CookieJar;
      let joinCode: string;
      let response: LightMyRequestResponse;

      Given('a host with a live contest named "Balcony Cook-off"', async () => {
        ({ app } = makeTestApp(undefined, { PARTICIPANT_WEB_ORIGIN: address }));
        jar = await signedInHost(app, 'ana@example.com');
        const contest = await liveContest(app, jar, 'Balcony Cook-off');
        joinCode = contest.joinCode;
        response = await read(app, jar, contest.id);
      });
      When('the host reads that contest', () => {
        expect(response.statusCode).toBe(200);
      });
      Then('the contest reports the link that joins it, as well as its join code', () => {
        const body = response.json();
        expect(body.joinCode).toBe(joinCode);
        expect(body.joinUrl).toBeTruthy();
      });
      And("that link is the address where people join, carrying that contest's join code", () => {
        expect(response.json().joinUrl).toBe(joiningAt(address, joinCode));
      });
    },
  );

  Scenario("The link carries the contest's own join code", ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let first: { id: string; joinCode: string };
    let second: { id: string; joinCode: string };
    let links: string[];

    Given('a host with two live contests, "Balcony Cook-off" and "Paella Sunday"', async () => {
      ({ app } = makeTestApp(undefined, { PARTICIPANT_WEB_ORIGIN: address }));
      jar = await signedInHost(app, 'ana@example.com');
      first = await liveContest(app, jar, 'Balcony Cook-off');
      second = await liveContest(app, jar, 'Paella Sunday');
    });
    When('the host reads each of them', async () => {
      const responses = [await read(app, jar, first.id), await read(app, jar, second.id)];
      links = responses.map((r) => r.json().joinUrl as string);
    });
    Then("each contest's link carries its own join code", () => {
      expect(links[0]).toBe(joiningAt(address, first.joinCode));
      expect(links[1]).toBe(joiningAt(address, second.joinCode));
    });
    And('the two links are not the same', () => {
      expect(links[0]).not.toBe(links[1]);
    });
  });

  Scenario('The link says nothing else about the contest', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let jar: CookieJar;
    let joinCode: string;
    let link: string;

    Given(
      'a host with a live contest named "Balcony Cook-off" with Ana and Bob taking part',
      async () => {
        ({ app } = makeTestApp(undefined, { PARTICIPANT_WEB_ORIGIN: address }));
        jar = await signedInHost(app, 'ana@example.com');
        const contest = await liveContest(app, jar, 'Balcony Cook-off');
        joinCode = contest.joinCode;
        link = (await read(app, jar, contest.id)).json().joinUrl as string;
      },
    );
    When('the host reads that contest', () => {
      expect(link).toBeTruthy();
    });
    Then(
      'the link carries the address where people join and the join code, and nothing more',
      () => {
        // Exactly the two things, joined — not "contains them somewhere".
        expect(link).toBe(joiningAt(address, joinCode));
      },
    );
    And("the link says nothing of the contest's name, its host, or who is taking part", () => {
      for (const secret of ['Balcony', 'Cook-off', 'ana@example.com', 'Ana', 'Bob']) {
        expect(link).not.toContain(secret);
      }
    });
  });

  Scenario(
    'The link leads to the place this deployment sends people to',
    ({ Given, And, When, Then }) => {
      let app: FastifyInstance;
      let jar: CookieJar;
      let link: string;

      Given('people join contests at "https://tapas.example.org"', () => {
        address = 'https://tapas.example.org';
      });
      And('a host with a live contest named "Balcony Cook-off"', async () => {
        ({ app } = makeTestApp(undefined, { PARTICIPANT_WEB_ORIGIN: address }));
        jar = await signedInHost(app, 'ana@example.com');
        const contest = await liveContest(app, jar, 'Balcony Cook-off');
        link = (await read(app, jar, contest.id)).json().joinUrl as string;
      });
      When('the host reads that contest', () => {
        expect(link).toBeTruthy();
      });
      Then('the link that joins it begins with "https://tapas.example.org"', () => {
        expect(link.startsWith('https://tapas.example.org')).toBe(true);
      });
    },
  );

  Scenario(
    'The address is not doubled up when it is given with a trailing slash',
    ({ Given, And, When, Then }) => {
      let app: FastifyInstance;
      let jar: CookieJar;
      let joinCode: string;
      let link: string;

      Given('people join contests at "https://join.sobremesa.es/"', () => {
        address = 'https://join.sobremesa.es/';
      });
      And('a host with a live contest named "Balcony Cook-off"', async () => {
        ({ app } = makeTestApp(undefined, { PARTICIPANT_WEB_ORIGIN: address }));
        jar = await signedInHost(app, 'ana@example.com');
        const contest = await liveContest(app, jar, 'Balcony Cook-off');
        joinCode = contest.joinCode;
        link = (await read(app, jar, contest.id)).json().joinUrl as string;
      });
      When('the host reads that contest', () => {
        expect(link).toBeTruthy();
      });
      Then('the link that joins it begins with "https://join.sobremesa.es"', () => {
        expect(link).toBe(joiningAt('https://join.sobremesa.es', joinCode));
      });
      And('the link holds no doubled separator', () => {
        // Past `https://`, nothing in the link should be a doubled slash.
        expect(link.slice('https://'.length)).not.toContain('//');
      });
    },
  );

  Scenario(
    'Reading a contest still reports the join code it has always reported',
    ({ Given, When, Then }) => {
      let app: FastifyInstance;
      let jar: CookieJar;
      let joinCode: string;
      let response: LightMyRequestResponse;

      Given('a host with a live contest named "Balcony Cook-off"', async () => {
        ({ app } = makeTestApp(undefined, { PARTICIPANT_WEB_ORIGIN: address }));
        jar = await signedInHost(app, 'ana@example.com');
        const contest = await liveContest(app, jar, 'Balcony Cook-off');
        joinCode = contest.joinCode;
        response = await read(app, jar, contest.id);
      });
      When('the host reads that contest', () => {
        expect(response.statusCode).toBe(200);
      });
      Then('the contest still reports the join code people type in', () => {
        // The link is an addition. A change that replaced the code would pass every
        // scenario above and fail this one.
        expect(response.json().joinCode).toBe(joinCode);
      });
    },
  );
});
