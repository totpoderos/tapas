import { fileURLToPath } from 'node:url';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { MutableClock, makeTestApp, makeTestAppOn } from '../support/test-server.js';
import { freshDatabase } from '../support/test-database.js';
import type { Database } from '../../src/db/database.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./rate-limiting.feature', import.meta.url)),
);

const RATE_LIMIT = 5;

async function attemptLogin(app: FastifyInstance): Promise<LightMyRequestResponse> {
  // An email that was never registered — login fails fast (401) without
  // touching any account's own lockout counter, so only the IP-level rate
  // limit is in play here.
  return app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'nobody@example.com', password: 'Wr0ng!Passw0rd' },
  });
}

/**
 * The same database with its record of attempts unreadable.
 *
 * Only the rate-limit table fails: everything else answers as usual, so the
 * refusal that follows is the limiter's and not the whole app falling over.
 */
function withoutRateLimitTable(database: Database): Database {
  return {
    ...database,
    prepare: (sql: string) =>
      sql.includes('rate_limits')
        ? {
            run: () => Promise.reject(new Error('rate_limits is unreadable')),
            get: () => Promise.reject(new Error('rate_limits is unreadable')),
            all: () => Promise.reject(new Error('rate_limits is unreadable')),
          }
        : database.prepare(sql),
    exec: (sql: string) => database.exec(sql),
    transaction: <T>(work: () => Promise<T>) => database.transaction(work),
    close: () => database.close(),
  };
}

async function attemptJoin(app: FastifyInstance): Promise<LightMyRequestResponse> {
  // An unknown join code — refused fast (404), so only the IP-level rate limit
  // on the claim endpoint is exercised here.
  return app.inject({
    method: 'POST',
    url: '/contests/GHOST1/claim',
    payload: { participantId: 'ana' },
  });
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('Repeated rapid login attempts are throttled', ({ When, Then }) => {
    let responses: LightMyRequestResponse[];

    When('many login attempts arrive in rapid succession from the same source', async () => {
      const { app } = await makeTestApp();
      responses = [];
      for (let attempt = 0; attempt < RATE_LIMIT + 1; attempt++) {
        responses.push(await attemptLogin(app));
      }
    });
    Then('further attempts are refused as too many requests', () => {
      const last = responses.at(-1);
      expect(last?.statusCode).toBe(429);
    });
  });

  Scenario('Repeated rapid join attempts are throttled', ({ When, Then }) => {
    let responses: LightMyRequestResponse[];

    When(
      'many attempts to join a contest arrive in rapid succession from the same source',
      async () => {
        const { app } = await makeTestApp();
        responses = [];
        for (let attempt = 0; attempt < RATE_LIMIT + 1; attempt++) {
          responses.push(await attemptJoin(app));
        }
      },
    );
    Then('further attempts are refused as too many requests', () => {
      const last = responses.at(-1);
      expect(last?.statusCode).toBe(429);
    });
  });

  Scenario('Ordinary traffic is not throttled', ({ When, Then }) => {
    let responses: LightMyRequestResponse[];

    When('a handful of requests are made well within the limit', async () => {
      const { app } = await makeTestApp();
      responses = [];
      for (let attempt = 0; attempt < RATE_LIMIT - 1; attempt++) {
        responses.push(await attemptLogin(app));
      }
    });
    Then('each is handled normally', () => {
      for (const response of responses) expect(response.statusCode).toBe(401);
    });
  });

  /*
   * Two apps over one database is the only way to say anything about this. Two
   * that share nothing look identical to two that share a database, when each is
   * asked on its own — which is exactly why a per-process counter could sit here
   * for a year looking correct.
   */
  Scenario('Attempts spread across instances are counted together', ({ Given, When, Then }) => {
    let instances: FastifyInstance[];
    let last: LightMyRequestResponse;

    Given('a deployment answering from two instances', async () => {
      const { database } = await freshDatabase();
      instances = [(await makeTestAppOn(database)).app, (await makeTestAppOn(database)).app];
    });
    When('attempts from one source are spread across both, more than the limit in total', async () => {
      for (let attempt = 0; attempt <= RATE_LIMIT; attempt++) {
        last = await attemptLogin(instances[attempt % 2]!);
      }
    });
    Then('the source is refused as though they had all arrived at one', () => {
      expect(last.statusCode).toBe(429);
    });
  });

  Scenario('A newly started instance does not reset the count', ({ Given, When, Then }) => {
    let database: Database;
    let spent: FastifyInstance;
    let refused: LightMyRequestResponse;

    Given('a deployment answering from two instances', async () => {
      ({ database } = await freshDatabase());
      spent = (await makeTestAppOn(database)).app;
    });
    When('a source spends its attempts on one instance, and a fresh instance starts', async () => {
      for (let attempt = 0; attempt <= RATE_LIMIT; attempt++) await attemptLogin(spent);
      const fresh = await makeTestAppOn(database);
      refused = await attemptLogin(fresh.app);
    });
    Then('that source is still refused by the fresh one', () => {
      expect(refused.statusCode).toBe(429);
    });
  });

  Scenario('A count that cannot be read refuses the attempt', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let response: LightMyRequestResponse;

    Given('a deployment whose record of attempts cannot be read', async () => {
      const { database } = await freshDatabase();
      app = (await makeTestAppOn(withoutRateLimitTable(database))).app;
    });
    When('a login attempt arrives', async () => {
      response = await attemptLogin(app);
    });
    Then('it is refused', () => {
      // Refused rather than served: the plugin is registered with
      // `skipOnError: false`, so a store that throws is a closed door.
      /*
       * 500, not the 401 an unknown email would ordinarily get. The difference
       * matters: asserting merely "not 2xx" would pass just as happily against
       * a limiter that never ran, because the login was going to fail anyway.
       */
      expect(response.statusCode).toBe(500);
    });
  });

  Scenario('A source that waited is served again', ({ When, Then }) => {
    let clock: MutableClock;
    let app: FastifyInstance;
    let afterWaiting: LightMyRequestResponse;

    When('a source spends its attempts and then waits out the window', async () => {
      clock = new MutableClock('2026-08-03T10:00:00.000Z');
      const { database } = await freshDatabase();
      app = (await makeTestAppOn(database, clock)).app;
      for (let attempt = 0; attempt <= RATE_LIMIT; attempt++) await attemptLogin(app);
      clock.advance(61_000);
      afterWaiting = await attemptLogin(app);
    });
    Then('it is served again', () => {
      expect(afterWaiting.statusCode).not.toBe(429);
    });
  });
});
