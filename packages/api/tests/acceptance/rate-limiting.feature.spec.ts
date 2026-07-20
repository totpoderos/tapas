import { fileURLToPath } from 'node:url';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp } from '../support/test-server.js';

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
      const { app } = makeTestApp();
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
        const { app } = makeTestApp();
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
      const { app } = makeTestApp();
      responses = [];
      for (let attempt = 0; attempt < RATE_LIMIT - 1; attempt++) {
        responses.push(await attemptLogin(app));
      }
    });
    Then('each is handled normally', () => {
      for (const response of responses) expect(response.statusCode).toBe(401);
    });
  });
});
