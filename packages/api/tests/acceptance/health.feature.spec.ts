import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp } from '../support/test-server.js';

// Proves the Gherkin acceptance harness (tasks.md 0.4). Acceptance specs use
// domain language only — the spec-leakage rule (design.md §11A.5).
const feature = await loadFeature(fileURLToPath(new URL('./health.feature', import.meta.url)));

describeFeature(feature, ({ Scenario }) => {
  Scenario('The service reports it is healthy', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let response: Awaited<ReturnType<FastifyInstance['inject']>>;

    Given('the API is running', () => {
      app = makeTestApp();
    });
    When('a client requests the health endpoint', async () => {
      response = await app.inject({ method: 'GET', url: '/health' });
    });
    Then('the API responds that its status is ok', async () => {
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
      await app.close();
    });
  });
});
