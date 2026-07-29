import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp, promoteToAdministrator, type TestApp } from '../support/test-server.js';
import { invitationSentTo, tokenFromLink } from '../support/invitations.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./inviting-a-host.feature', import.meta.url)),
);

const STRONG_PASSWORD = 'Str0ng!Passw0rd';
const INVITED = 'nuevo@example.com';

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
  options: { method: 'GET' | 'POST'; url: string; payload?: Record<string, unknown> },
): Promise<LightMyRequestResponse> {
  const response: LightMyRequestResponse = await app.inject({
    ...options,
    headers: { cookie: jar.header() },
  });
  jar.capture(response);
  return response;
}

async function registerAndLogin(
  app: FastifyInstance,
  jar: CookieJar,
  email: string,
): Promise<void> {
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
}

async function signInAsAdministrator(
  app: FastifyInstance,
  db: DatabaseSync,
  jar: CookieJar,
  email: string,
): Promise<void> {
  await request(app, jar, {
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: STRONG_PASSWORD },
  });
  promoteToAdministrator(db, email);
  await request(app, jar, {
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: STRONG_PASSWORD },
  });
}

function invitationRows(db: DatabaseSync, email: string): unknown[] {
  return db.prepare('SELECT * FROM host_invitations WHERE email = ?').all(email);
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('An administrator invites an address', ({ Given, When, Then }) => {
    let test: TestApp;
    let jar: CookieJar;

    Given('an administrator "ana@example.com"', async () => {
      test = makeTestApp();
      jar = new CookieJar();
      await signInAsAdministrator(test.app, test.db, jar, 'ana@example.com');
    });
    When('the administrator invites "nuevo@example.com"', async () => {
      const response = await request(test.app, jar, {
        method: 'POST',
        url: '/admin/invites',
        payload: { email: INVITED },
      });
      expect(response.statusCode).toBe(201);
    });
    Then('an invitation for "nuevo@example.com" is pending', () => {
      expect(invitationRows(test.db, INVITED)).toHaveLength(1);
    });
  });

  Scenario('An ordinary host cannot invite', ({ Given, When, Then, And }) => {
    let test: TestApp;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a signed-in host "bob@example.com"', async () => {
      test = makeTestApp();
      jar = new CookieJar();
      await registerAndLogin(test.app, jar, 'bob@example.com');
    });
    When('that host tries to invite "nuevo@example.com"', async () => {
      response = await request(test.app, jar, {
        method: 'POST',
        url: '/admin/invites',
        payload: { email: INVITED },
      });
    });
    Then('access is refused as not allowed', () => {
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('NOT_ALLOWED');
    });
    And('no invitation exists for "nuevo@example.com"', () => {
      expect(invitationRows(test.db, INVITED)).toHaveLength(0);
    });
  });

  Scenario('Inviting requires being signed in', ({ Given, When, Then }) => {
    let test: TestApp;
    let response: LightMyRequestResponse;

    Given('no one is signed in', () => {
      test = makeTestApp();
    });
    When('someone tries to invite "nuevo@example.com"', async () => {
      response = await request(test.app, new CookieJar(), {
        method: 'POST',
        url: '/admin/invites',
        payload: { email: INVITED },
      });
    });
    Then('access is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });

  Scenario('An address that already has an account cannot be invited', ({ Given, And, When, Then }) => {
    let test: TestApp;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('an administrator "ana@example.com"', async () => {
      test = makeTestApp();
      jar = new CookieJar();
      await signInAsAdministrator(test.app, test.db, jar, 'ana@example.com');
    });
    And('a host "bob@example.com"', async () => {
      await registerAndLogin(test.app, new CookieJar(), 'bob@example.com');
    });
    When('the administrator invites "bob@example.com"', async () => {
      response = await request(test.app, jar, {
        method: 'POST',
        url: '/admin/invites',
        payload: { email: 'bob@example.com' },
      });
    });
    Then('inviting is refused because that address is already registered', () => {
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('EMAIL_TAKEN');
    });
  });

  Scenario('A message is sent to the invited address', ({ Given, When, Then, And }) => {
    let test: TestApp;
    let jar: CookieJar;

    Given('an administrator "ana@example.com"', async () => {
      test = makeTestApp();
      jar = new CookieJar();
      await signInAsAdministrator(test.app, test.db, jar, 'ana@example.com');
    });
    When('the administrator invites "nuevo@example.com"', async () => {
      await request(test.app, jar, {
        method: 'POST',
        url: '/admin/invites',
        payload: { email: INVITED },
      });
    });
    Then('a message is sent to "nuevo@example.com"', () => {
      expect(test.mailer.sent).toHaveLength(1);
      expect(test.mailer.sent[0]!.to).toBe(INVITED);
    });
    And('it carries a link for that invitation', () => {
      expect(test.mailer.sent[0]!.link).toMatch(/^https?:\/\/.+\/.+$/);
    });
  });

  Scenario('The stored invitation does not reveal the link', ({ Given, When, Then }) => {
    let test: TestApp;
    let jar: CookieJar;

    Given('an administrator "ana@example.com"', async () => {
      test = makeTestApp();
      jar = new CookieJar();
      await signInAsAdministrator(test.app, test.db, jar, 'ana@example.com');
    });
    When('the administrator invites "nuevo@example.com"', async () => {
      await request(test.app, jar, {
        method: 'POST',
        url: '/admin/invites',
        payload: { email: INVITED },
      });
    });
    Then('the stored invitation does not contain the link', () => {
      const stored = JSON.stringify(invitationRows(test.db, INVITED));
      expect(stored).not.toContain(tokenFromLink(test.mailer.sent[0]!.link));
    });
  });

  Scenario('Opening a good link says whom it is for', ({ Given, When, Then, And }) => {
    let test: TestApp;
    let token: string;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      ({ test, token } = await invitationSentTo(INVITED));
    });
    When('the invited person opens their link', async () => {
      response = await test.app.inject({ method: 'GET', url: `/invites/${token}` });
    });
    Then('the invitation is reported as still good', () => {
      expect(response.statusCode).toBe(200);
    });
    And('it names "nuevo@example.com"', () => {
      expect(response.json().email).toBe(INVITED);
    });
  });

  Scenario('Opening a link does not spend it', ({ Given, When, And, Then }) => {
    let test: TestApp;
    let token: string;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      ({ test, token } = await invitationSentTo(INVITED));
    });
    When('the invited person opens their link twice', async () => {
      await test.app.inject({ method: 'GET', url: `/invites/${token}` });
      const second = await test.app.inject({ method: 'GET', url: `/invites/${token}` });
      expect(second.statusCode).toBe(200);
    });
    And('they accept with a strong password', async () => {
      const response = await test.app.inject({
        method: 'POST',
        url: `/invites/${token}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
      expect(response.statusCode).toBe(201);
    });
    Then('a host account exists for "nuevo@example.com"', async () => {
      const signedIn = await test.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: INVITED, password: STRONG_PASSWORD },
      });
      expect(signedIn.statusCode).toBe(200);
    });
  });

  Scenario('The invited person becomes a host and can sign in', ({ Given, When, Then, And }) => {
    let test: TestApp;
    let token: string;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      ({ test, token } = await invitationSentTo(INVITED));
    });
    When('the invited person accepts with a strong password', async () => {
      const response = await test.app.inject({
        method: 'POST',
        url: `/invites/${token}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
      expect(response.statusCode).toBe(201);
    });
    Then('a host account exists for "nuevo@example.com"', () => {
      const row = test.db
        .prepare('SELECT email FROM host_accounts WHERE email = ?')
        .get(INVITED) as { email: string } | undefined;
      expect(row?.email).toBe(INVITED);
    });
    And('that person can sign in with that address and password', async () => {
      const signedIn = await test.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: INVITED, password: STRONG_PASSWORD },
      });
      expect(signedIn.statusCode).toBe(200);
    });
  });

  Scenario('Accepting never produces an administrator', ({ Given, When, Then }) => {
    let test: TestApp;
    let token: string;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      ({ test, token } = await invitationSentTo(INVITED));
    });
    When('the invited person accepts with a strong password', async () => {
      await test.app.inject({
        method: 'POST',
        url: `/invites/${token}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
    });
    Then('the account created is not an administrator', () => {
      const row = test.db
        .prepare('SELECT role FROM host_accounts WHERE email = ?')
        .get(INVITED) as { role: string } | undefined;
      expect(row?.role).toBe('host');
    });
  });

  Scenario('Accepting does not by itself sign the person in', ({ Given, When, Then }) => {
    let test: TestApp;
    let token: string;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      ({ test, token } = await invitationSentTo(INVITED));
    });
    When('the invited person accepts with a strong password', async () => {
      response = await test.app.inject({
        method: 'POST',
        url: `/invites/${token}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
    });
    Then('no session is granted by the acceptance itself', () => {
      expect(response.statusCode).toBe(201);
      expect(response.cookies).toHaveLength(0);
    });
  });

  Scenario('An accepted link cannot be used again', ({ Given, When, And, Then }) => {
    let test: TestApp;
    let token: string;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      ({ test, token } = await invitationSentTo(INVITED));
    });
    When('the invited person accepts with a strong password', async () => {
      await test.app.inject({
        method: 'POST',
        url: `/invites/${token}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
    });
    And('they try to accept with the same link again', async () => {
      response = await test.app.inject({
        method: 'POST',
        url: `/invites/${token}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
    });
    Then('accepting is refused because the link cannot be used', () => {
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('INVITATION_UNUSABLE');
    });
  });

  Scenario('An unknown link is refused', ({ Given, When, Then }) => {
    let test: TestApp;
    let response: LightMyRequestResponse;

    Given('an administrator "ana@example.com"', async () => {
      test = makeTestApp();
      await signInAsAdministrator(test.app, test.db, new CookieJar(), 'ana@example.com');
    });
    When('someone tries to accept with a link that no invitation ever had', async () => {
      response = await test.app.inject({
        method: 'POST',
        url: '/invites/a-token-nobody-ever-issued/accept',
        payload: { password: STRONG_PASSWORD },
      });
    });
    Then('accepting is refused because the link cannot be used', () => {
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('INVITATION_UNUSABLE');
    });
  });

  Scenario('An already-used link is refused the same way', ({ Given, When, And, Then }) => {
    let test: TestApp;
    let token: string;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      ({ test, token } = await invitationSentTo(INVITED));
    });
    When('the invited person accepts with a strong password', async () => {
      await test.app.inject({
        method: 'POST',
        url: `/invites/${token}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
    });
    And('they try to accept with the same link again', async () => {
      response = await test.app.inject({
        method: 'POST',
        url: `/invites/${token}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
    });
    Then('the refusal is the same as for a link that never existed', async () => {
      const unknown = await test.app.inject({
        method: 'POST',
        url: '/invites/a-token-nobody-ever-issued/accept',
        payload: { password: STRONG_PASSWORD },
      });
      expect(response.statusCode).toBe(unknown.statusCode);
      expect(response.json()).toEqual(unknown.json());
    });
  });

  Scenario('The refusal reveals no address', ({ Given, When, And, Then }) => {
    let test: TestApp;
    let token: string;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      ({ test, token } = await invitationSentTo(INVITED));
    });
    When('the invited person accepts with a strong password', async () => {
      await test.app.inject({
        method: 'POST',
        url: `/invites/${token}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
    });
    And('they try to accept with the same link again', async () => {
      response = await test.app.inject({
        method: 'POST',
        url: `/invites/${token}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
    });
    Then('the refusal names no email address', () => {
      expect(response.body).not.toContain(INVITED);
      expect(response.body).not.toContain('@');
    });
  });

  Scenario('A weak password is refused', ({ Given, When, Then }) => {
    let test: TestApp;
    let token: string;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      ({ test, token } = await invitationSentTo(INVITED));
    });
    When('the invited person tries to accept with the weak password "short"', async () => {
      response = await test.app.inject({
        method: 'POST',
        url: `/invites/${token}/accept`,
        payload: { password: 'short' },
      });
    });
    Then('accepting is refused because the password is too weak', () => {
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('WEAK_PASSWORD');
    });
  });

  Scenario('The invitation still works after a refused password', ({ Given, When, And, Then }) => {
    let test: TestApp;
    let token: string;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      ({ test, token } = await invitationSentTo(INVITED));
    });
    When('the invited person tries to accept with the weak password "short"', async () => {
      const refused = await test.app.inject({
        method: 'POST',
        url: `/invites/${token}/accept`,
        payload: { password: 'short' },
      });
      expect(refused.statusCode).toBe(400);
    });
    And('they then accept with a strong password', async () => {
      const response = await test.app.inject({
        method: 'POST',
        url: `/invites/${token}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
      expect(response.statusCode).toBe(201);
    });
    Then('a host account exists for "nuevo@example.com"', () => {
      const row = test.db
        .prepare('SELECT email FROM host_accounts WHERE email = ?')
        .get(INVITED) as { email: string } | undefined;
      expect(row?.email).toBe(INVITED);
    });
  });
});
