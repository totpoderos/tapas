import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';
import { makeTestApp } from '../../support/test-server.js';
import type { Env } from '../../../src/index.js';

/**
 * Helmet's defaults are written for a site served over HTTPS. Two of them are
 * actively harmful over the plain HTTP a development server speaks, and Safari
 * is the browser that acts on them:
 *
 *   Strict-Transport-Security  Safari applies HSTS to `localhost`; Chrome
 *                              special-cases localhost and ignores it. One
 *                              response pins localhost to HTTPS for a YEAR,
 *                              across every port — and the pin is not cleared by
 *                              clearing cookies, so a developer who hits it once
 *                              has to delete ~/Library/Cookies/HSTS.plist.
 *
 *   upgrade-insecure-requests  Tells the browser to reissue http:// requests as
 *                              https://, which nothing is listening for.
 *
 * Production keeps both. These assert the headers a browser actually receives,
 * because that is the only thing it acts on.
 */

const appFor = async (nodeEnv: Env['NODE_ENV']): Promise<FastifyInstance> =>
  (await makeTestApp(undefined, { NODE_ENV: nodeEnv })).app;

const headers = async (app: FastifyInstance) => {
  const response = await app.inject({
    method: 'GET',
    url: '/health',
    headers: { 'x-forwarded-proto': 'https' }, // production redirects plain HTTP
  });
  return response.headers as Record<string, string | undefined>;
};

describe('security headers suit how the site is served', async () => {
  describe('in production', async () => {
    it('pins HTTPS with HSTS', async () => {
      const sent = await headers(await appFor('production'));
      expect(sent['strict-transport-security']).toMatch(/max-age=\d+/);
    });

    it('asks the browser to upgrade insecure requests', async () => {
      const sent = await headers(await appFor('production'));
      expect(sent['content-security-policy']).toContain('upgrade-insecure-requests');
    });
  });

  describe('in development, where the site is served over plain HTTP', async () => {
    it('does not pin HTTPS, which Safari would honour on localhost for a year', async () => {
      const sent = await headers(await appFor('development'));
      expect(sent['strict-transport-security']).toBeUndefined();
    });

    it('does not ask the browser to upgrade requests nothing is listening for', async () => {
      const sent = await headers(await appFor('development'));
      expect(sent['content-security-policy']).not.toContain('upgrade-insecure-requests');
    });

    // Relaxing those two must not quietly drop the rest of the hardening.
    it('keeps the rest of the policy intact', async () => {
      const sent = await headers(await appFor('development'));
      expect(sent['content-security-policy']).toContain("default-src 'self'");
      expect(sent['content-security-policy']).toContain("object-src 'none'");
      expect(sent['x-content-type-options']).toBe('nosniff');
      expect(sent['x-frame-options']).toBe('DENY');
      expect(sent['referrer-policy']).toBe('no-referrer');
    });
  });

  // Same reasoning as the session cookie: only an explicit `development` relaxes
  // anything, so an unset or unfamiliar environment stays hardened.
  it('stays hardened for any environment that is not explicitly development', async () => {
    const sent = await headers(await appFor('staging' as unknown as Env['NODE_ENV']));
    expect(sent['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(sent['content-security-policy']).toContain('upgrade-insecure-requests');
  });
});
