import { fileURLToPath } from 'node:url';
import Fastify, { type LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp } from '../support/test-server.js';
import { registerErrorHandling } from '../../src/http/error-handling.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./response-hardening.feature', import.meta.url)),
);

describeFeature(feature, ({ Scenario }) => {
  Scenario('A response carries standard security headers', ({ When, Then }) => {
    let response: LightMyRequestResponse;

    When('any request is made to the API', async () => {
      const { app } = makeTestApp();
      response = await app.inject({ method: 'GET', url: '/health' });
    });
    Then('the response carries the standard hardening headers', () => {
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['referrer-policy']).toBeTruthy();
      expect(response.headers['strict-transport-security']).toBeTruthy();
    });
  });

  Scenario('A request from one of the frontends is allowed', ({ When, Then }) => {
    let response: LightMyRequestResponse;
    const hostAppOrigin = 'http://localhost:5173';

    When("a request arrives from the host app's origin", async () => {
      const { app } = makeTestApp();
      response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { origin: hostAppOrigin },
      });
    });
    Then('the response allows that origin', () => {
      expect(response.headers['access-control-allow-origin']).toBe(hostAppOrigin);
    });
  });

  Scenario('A request from an unrecognized site is refused', ({ When, Then }) => {
    let response: LightMyRequestResponse;

    When('a request arrives from an unrecognized origin', async () => {
      const { app } = makeTestApp();
      response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { origin: 'http://evil.example' },
      });
    });
    Then('the response does not allow that origin', () => {
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  Scenario('A plain HTTP request is redirected to HTTPS in production', ({ Given, When, Then }) => {
    let response: LightMyRequestResponse;

    Given('the API is running in production', () => {
      // set up happens in the When step, once we know the request shape
    });
    When('a request arrives over plain HTTP', async () => {
      const { app } = makeTestApp(undefined, { NODE_ENV: 'production' });
      response = await app.inject({ method: 'GET', url: '/health' });
    });
    Then('the response redirects to the HTTPS equivalent', () => {
      expect(response.statusCode).toBe(301);
      expect(response.headers.location).toMatch(/^https:\/\//);
    });
  });

  Scenario(
    'An unexpected server error does not leak internals in production',
    ({ Given, When, Then }) => {
      let response: LightMyRequestResponse;

      Given('the API is running in production', () => {
        // set up happens in the When step
      });
      When('an unexpected error occurs while handling a request', async () => {
        // A minimal app reusing the real, exported error handler plus a route
        // that deliberately throws — production server.ts carries no such
        // route; this isolates the error-handling behaviour without a backdoor
        // in the shipped server.
        const app = Fastify({ logger: false });
        registerErrorHandling(app, true);
        app.get('/boom', async () => {
          throw new Error('sensitive internal detail — should never reach the client');
        });
        response = await app.inject({ method: 'GET', url: '/boom' });
      });
      Then('the response is a generic error with no internal detail', () => {
        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual({
          error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
        });
        expect(response.body).not.toContain('sensitive internal detail');
      });
    },
  );
});
