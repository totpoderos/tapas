import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import {
  MutableClock,
  makeTestApp,
  makeTestAppWithoutMail,
  promoteToAdministrator,
  seedHost,
  type TestApp,
} from '../support/test-server.js';
import { invitationSentTo, signInAdministrator, tokenFromLink } from '../support/invitations.js';

const ISSUED_AT = '2026-07-29T10:00:00.000Z';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
  await seedHost(app, email, STRONG_PASSWORD);
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
  await seedHost(app, email, STRONG_PASSWORD);
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

/** An administrator on an app whose mailer refuses everything, as a dead mail server would. */
async function administratorWithNoMailServer(): Promise<{ test: TestApp; jar: CookieJar }> {
  const test = makeTestApp();
  const jar = new CookieJar();
  await signInAsAdministrator(test.app, test.db, jar, 'ana@example.com');
  test.mailer.failEverySend();
  return { test, jar };
}

function storedInvitation(db: DatabaseSync, email: string) {
  return db.prepare('SELECT * FROM host_invitations WHERE email = ?').get(email) as
    | { message_sent: number | null }
    | undefined;
}

type Invited = Awaited<ReturnType<typeof invitationSentTo>>;

/** An administrative request on an invitation, named by id — never by token. */
function asAdministrator(
  sent: Invited,
  options: { method: 'GET' | 'POST'; url: string; payload?: Record<string, unknown> },
): Promise<LightMyRequestResponse> {
  return sent.test.app.inject({ ...options, headers: { cookie: sent.adminCookie } });
}

function acceptWith(test: TestApp, token: string): Promise<LightMyRequestResponse> {
  return test.app.inject({
    method: 'POST',
    url: `/invites/${token}/accept`,
    payload: { password: STRONG_PASSWORD },
  });
}

/** The token from the most recent message — how a resent invitation's recipient gets theirs. */
function newestToken(test: TestApp): string {
  return tokenFromLink(test.mailer.sent.at(-1)!.link);
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

  Scenario('A resent invitation still produces an ordinary host', ({ Given, When, And, Then }) => {
    let sent: Invited;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo(INVITED);
    });
    When('the administrator resends it', async () => {
      const resent = await asAdministrator(sent, {
        method: 'POST',
        url: `/admin/invites/${sent.id}/resend`,
      });
      expect(resent.statusCode).toBe(201);
    });
    And('the invited person accepts with the new link', async () => {
      const accepted = await acceptWith(sent.test, newestToken(sent.test));
      expect(accepted.statusCode).toBe(201);
    });
    Then('the account created is not an administrator', () => {
      const row = sent.test.db
        .prepare('SELECT role FROM host_accounts WHERE email = ?')
        .get(INVITED) as { role: string } | undefined;
      expect(row?.role).toBe('host');
    });
  });

  Scenario('An invitation from an administrator never produces another administrator', ({ Given, When, Then }) => {
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

  Scenario('A link still works within the window', ({ Given, When, And, Then }) => {
    let test: TestApp;
    let token: string;
    let clock: MutableClock;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      clock = new MutableClock(ISSUED_AT);
      ({ test, token } = await invitationSentTo(INVITED, clock));
    });
    When('nearly 24 hours pass', () => {
      clock.advance(ONE_DAY_MS - 1000);
    });
    And('the invited person accepts with a strong password', async () => {
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

  Scenario('A link no longer accepts once the window has passed', ({ Given, When, And, Then }) => {
    let test: TestApp;
    let token: string;
    let clock: MutableClock;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      clock = new MutableClock(ISSUED_AT);
      ({ test, token } = await invitationSentTo(INVITED, clock));
    });
    When('more than 24 hours pass', () => {
      clock.advance(ONE_DAY_MS + 1000);
    });
    And('the invited person tries to accept with a strong password', async () => {
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
    And('no host account exists for "nuevo@example.com"', () => {
      const row = test.db.prepare('SELECT email FROM host_accounts WHERE email = ?').get(INVITED);
      expect(row).toBeUndefined();
    });
  });

  Scenario('A link no longer opens once the window has passed', ({ Given, When, And, Then }) => {
    let test: TestApp;
    let token: string;
    let clock: MutableClock;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      clock = new MutableClock(ISSUED_AT);
      ({ test, token } = await invitationSentTo(INVITED, clock));
    });
    When('more than 24 hours pass', () => {
      clock.advance(ONE_DAY_MS + 1000);
    });
    And('the invited person opens their link', async () => {
      response = await test.app.inject({ method: 'GET', url: `/invites/${token}` });
    });
    Then('opening is refused because the link cannot be used', () => {
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('INVITATION_UNUSABLE');
    });
  });

  Scenario(
    'An expired link is refused the same way as one that never existed',
    ({ Given, When, And, Then }) => {
      let test: TestApp;
      let token: string;
      let clock: MutableClock;
      let response: LightMyRequestResponse;

      Given('an invitation was sent to "nuevo@example.com"', async () => {
        clock = new MutableClock(ISSUED_AT);
        ({ test, token } = await invitationSentTo(INVITED, clock));
      });
      When('more than 24 hours pass', () => {
        clock.advance(ONE_DAY_MS + 1000);
      });
      And('the invited person tries to accept with a strong password', async () => {
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
        expect(response.body).toBe(unknown.body);
      });
      And('the refusal names no email address', () => {
        expect(response.body).not.toContain('@');
      });
    },
  );

  Scenario('An expired invitation stays expired', ({ Given, When, And, Then }) => {
    let test: TestApp;
    let token: string;
    let clock: MutableClock;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      clock = new MutableClock(ISSUED_AT);
      ({ test, token } = await invitationSentTo(INVITED, clock));
    });
    When('more than 24 hours pass', () => {
      clock.advance(ONE_DAY_MS + 1000);
    });
    And('the invited person opens their link and then tries to accept', async () => {
      await test.app.inject({ method: 'GET', url: `/invites/${token}` });
      response = await test.app.inject({
        method: 'POST',
        url: `/invites/${token}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
    });
    Then('accepting is still refused because the link cannot be used', () => {
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('INVITATION_UNUSABLE');
    });
  });

  Scenario('An administrator sees the invitations and how they stand', ({ Given, When, Then, And }) => {
    let sent: Invited;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo(INVITED);
    });
    When('the administrator asks to see the invitations', async () => {
      response = await asAdministrator(sent, { method: 'GET', url: '/admin/invites' });
    });
    Then('that invitation is listed with the address it was sent to', () => {
      expect(response.statusCode).toBe(200);
      const listed = response.json().invitations;
      expect(listed).toHaveLength(1);
      expect(listed[0].email).toBe(INVITED);
    });
    And('it is shown as pending', () => {
      expect(response.json().invitations[0].status).toBe('pending');
    });
  });

  Scenario('An invitation whose time has run out is shown as expired', ({ Given, When, And, Then }) => {
    let sent: Invited;
    let clock: MutableClock;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      clock = new MutableClock(ISSUED_AT);
      sent = await invitationSentTo(INVITED, clock);
    });
    When('more than 24 hours pass', () => {
      clock.advance(ONE_DAY_MS + 1000);
    });
    And('the administrator asks to see the invitations', async () => {
      sent.adminCookie = await signInAdministrator(sent.test); // the day-old session has expired
      response = await asAdministrator(sent, { method: 'GET', url: '/admin/invites' });
    });
    Then('that invitation is shown as expired', () => {
      expect(response.json().invitations[0].status).toBe('expired');
    });
  });

  Scenario('The listing reveals no link', ({ Given, When, Then }) => {
    let sent: Invited;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo(INVITED);
    });
    When('the administrator asks to see the invitations', async () => {
      response = await asAdministrator(sent, { method: 'GET', url: '/admin/invites' });
    });
    Then("no invitation's link appears in the listing", () => {
      expect(response.body).not.toContain(sent.token);
    });
  });

  Scenario('An ordinary host cannot see the invitations', ({ Given, When, Then }) => {
    let test: TestApp;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('a signed-in host "bob@example.com"', async () => {
      test = makeTestApp();
      jar = new CookieJar();
      await registerAndLogin(test.app, jar, 'bob@example.com');
    });
    When('that host asks to see the invitations', async () => {
      response = await request(test.app, jar, { method: 'GET', url: '/admin/invites' });
    });
    Then('access is refused as not allowed', () => {
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('NOT_ALLOWED');
    });
  });

  Scenario('A revoked link stops working', ({ Given, When, And, Then }) => {
    let sent: Invited;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo(INVITED);
    });
    When('the administrator revokes it', async () => {
      const revoked = await asAdministrator(sent, {
        method: 'POST',
        url: `/admin/invites/${sent.id}/revoke`,
      });
      expect(revoked.statusCode).toBe(200);
    });
    And('the invited person tries to accept with a strong password', async () => {
      response = await acceptWith(sent.test, sent.token);
    });
    Then('accepting is refused because the link cannot be used', () => {
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('INVITATION_UNUSABLE');
    });
    And('no host account exists for "nuevo@example.com"', () => {
      const row = sent.test.db
        .prepare('SELECT email FROM host_accounts WHERE email = ?')
        .get(INVITED);
      expect(row).toBeUndefined();
    });
  });

  Scenario('A revoked link no longer opens either', ({ Given, When, And, Then }) => {
    let sent: Invited;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo(INVITED);
    });
    When('the administrator revokes it', async () => {
      await asAdministrator(sent, { method: 'POST', url: `/admin/invites/${sent.id}/revoke` });
    });
    And('the invited person opens their link', async () => {
      response = await sent.test.app.inject({ method: 'GET', url: `/invites/${sent.token}` });
    });
    Then('opening is refused because the link cannot be used', () => {
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('INVITATION_UNUSABLE');
    });
  });

  Scenario('An accepted invitation cannot be revoked', ({ Given, When, And, Then }) => {
    let sent: Invited;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo(INVITED);
    });
    When('the invited person accepts with a strong password', async () => {
      expect((await acceptWith(sent.test, sent.token)).statusCode).toBe(201);
    });
    And('the administrator tries to revoke it', async () => {
      response = await asAdministrator(sent, {
        method: 'POST',
        url: `/admin/invites/${sent.id}/revoke`,
      });
    });
    Then('revoking is refused because there is nothing to revoke', () => {
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('NOTHING_TO_REVOKE');
    });
  });

  Scenario('An invitation cannot be revoked twice', ({ Given, When, And, Then }) => {
    let sent: Invited;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo(INVITED);
    });
    When('the administrator revokes it', async () => {
      await asAdministrator(sent, { method: 'POST', url: `/admin/invites/${sent.id}/revoke` });
    });
    And('the administrator tries to revoke it again', async () => {
      response = await asAdministrator(sent, {
        method: 'POST',
        url: `/admin/invites/${sent.id}/revoke`,
      });
    });
    Then('revoking is refused because there is nothing to revoke', () => {
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('NOTHING_TO_REVOKE');
    });
  });

  Scenario('Resending sends a new link to the same address', ({ Given, When, Then, And }) => {
    let sent: Invited;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo(INVITED);
    });
    When('the administrator resends it', async () => {
      const resent = await asAdministrator(sent, {
        method: 'POST',
        url: `/admin/invites/${sent.id}/resend`,
      });
      expect(resent.statusCode).toBe(201);
    });
    Then('a message is sent to "nuevo@example.com"', () => {
      expect(sent.test.mailer.sent).toHaveLength(2);
      expect(sent.test.mailer.sent[1]!.to).toBe(INVITED);
    });
    And('it carries a different link from the first', () => {
      expect(sent.test.mailer.sent[1]!.link).not.toBe(sent.test.mailer.sent[0]!.link);
    });
  });

  Scenario('The new link works and the old one dies', ({ Given, When, And, Then }) => {
    let sent: Invited;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo(INVITED);
    });
    When('the administrator resends it', async () => {
      await asAdministrator(sent, { method: 'POST', url: `/admin/invites/${sent.id}/resend` });
    });
    And('the invited person tries to accept with the original link', async () => {
      response = await acceptWith(sent.test, sent.token);
    });
    Then('accepting is refused because the link cannot be used', () => {
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('INVITATION_UNUSABLE');
    });
    And('accepting with the new link creates the host account', async () => {
      const withNewLink = await acceptWith(sent.test, newestToken(sent.test));
      expect(withNewLink.statusCode).toBe(201);
    });
  });

  Scenario('The new invitation gets its own full window', ({ Given, When, And, Then }) => {
    let sent: Invited;
    let clock: MutableClock;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      clock = new MutableClock(ISSUED_AT);
      sent = await invitationSentTo(INVITED, clock);
    });
    When('nearly 24 hours pass and the administrator resends it', async () => {
      clock.advance(ONE_DAY_MS - 1000);
      sent.adminCookie = await signInAdministrator(sent.test); // the day-old session has expired
      const resent = await asAdministrator(sent, {
        method: 'POST',
        url: `/admin/invites/${sent.id}/resend`,
      });
      expect(resent.statusCode).toBe(201);
    });
    And('nearly another 24 hours pass', () => {
      clock.advance(ONE_DAY_MS - 1000);
    });
    And('the invited person accepts with the new link', async () => {
      const accepted = await acceptWith(sent.test, newestToken(sent.test));
      expect(accepted.statusCode).toBe(201);
    });
    Then('a host account exists for "nuevo@example.com"', () => {
      const row = sent.test.db
        .prepare('SELECT email FROM host_accounts WHERE email = ?')
        .get(INVITED) as { email: string } | undefined;
      expect(row?.email).toBe(INVITED);
    });
  });

  Scenario('An expired invitation can be resent', ({ Given, When, And, Then }) => {
    let sent: Invited;
    let clock: MutableClock;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      clock = new MutableClock(ISSUED_AT);
      sent = await invitationSentTo(INVITED, clock);
    });
    When('more than 24 hours pass', () => {
      clock.advance(ONE_DAY_MS + 1000);
    });
    And('the administrator resends it', async () => {
      sent.adminCookie = await signInAdministrator(sent.test); // the day-old session has expired
      const resent = await asAdministrator(sent, {
        method: 'POST',
        url: `/admin/invites/${sent.id}/resend`,
      });
      expect(resent.statusCode).toBe(201);
    });
    Then('the invited person can accept with the new link', async () => {
      const accepted = await acceptWith(sent.test, newestToken(sent.test));
      expect(accepted.statusCode).toBe(201);
    });
  });

  Scenario('A revoked invitation cannot be resent', ({ Given, When, And, Then }) => {
    let sent: Invited;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo(INVITED);
    });
    When('the administrator revokes it', async () => {
      await asAdministrator(sent, { method: 'POST', url: `/admin/invites/${sent.id}/revoke` });
    });
    And('the administrator tries to resend it', async () => {
      response = await asAdministrator(sent, {
        method: 'POST',
        url: `/admin/invites/${sent.id}/resend`,
      });
    });
    Then('resending is refused because that invitation is finished', () => {
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('INVITATION_FINISHED');
    });
  });

  Scenario('An accepted invitation cannot be resent', ({ Given, When, And, Then }) => {
    let sent: Invited;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo(INVITED);
    });
    When('the invited person accepts with a strong password', async () => {
      expect((await acceptWith(sent.test, sent.token)).statusCode).toBe(201);
    });
    And('the administrator tries to resend it', async () => {
      response = await asAdministrator(sent, {
        method: 'POST',
        url: `/admin/invites/${sent.id}/resend`,
      });
    });
    Then('resending is refused because that invitation is finished', () => {
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('INVITATION_FINISHED');
    });
  });

  Scenario('A superseded invitation cannot be resent again', ({ Given, When, And, Then }) => {
    let sent: Invited;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo(INVITED);
    });
    When('the administrator resends it', async () => {
      await asAdministrator(sent, { method: 'POST', url: `/admin/invites/${sent.id}/resend` });
    });
    And('the administrator tries to resend the original invitation again', async () => {
      response = await asAdministrator(sent, {
        method: 'POST',
        url: `/admin/invites/${sent.id}/resend`,
      });
    });
    Then('resending is refused because that invitation is finished', () => {
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('INVITATION_FINISHED');
    });
  });

  Scenario('A revoked link is refused exactly like one that never existed', ({ Given, When, And, Then }) => {
    let sent: Invited;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo(INVITED);
    });
    When('the administrator revokes it', async () => {
      await asAdministrator(sent, { method: 'POST', url: `/admin/invites/${sent.id}/revoke` });
    });
    And('the invited person tries to accept with a strong password', async () => {
      response = await acceptWith(sent.test, sent.token);
    });
    Then('the refusal is the same as for a link that never existed', async () => {
      const unknown = await acceptWith(sent.test, 'a-token-nobody-ever-issued');
      expect(response.statusCode).toBe(unknown.statusCode);
      expect(response.body).toBe(unknown.body);
    });
    And('the refusal names no email address', () => {
      expect(response.body).not.toContain('@');
    });
  });

  // Not a scenario in the feature: the feature says each refusal matches the
  // unknown one, which is what a spec reader cares about. This pins the
  // consequence — all five are identical to each other, so no future route can
  // helpfully leak which one applied.
  Scenario('A superseded link is refused exactly like one that never existed', ({ Given, When, And, Then }) => {
    let sent: Invited;
    let response: LightMyRequestResponse;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo(INVITED);
    });
    When('the administrator resends it', async () => {
      await asAdministrator(sent, { method: 'POST', url: `/admin/invites/${sent.id}/resend` });
    });
    And('the invited person tries to accept with the original link', async () => {
      response = await acceptWith(sent.test, sent.token);
    });
    Then('the refusal is the same as for a link that never existed', async () => {
      const unknown = await acceptWith(sent.test, 'a-token-nobody-ever-issued');
      expect(response.statusCode).toBe(unknown.statusCode);
      expect(response.body).toBe(unknown.body);
    });
  });

  Scenario('The invitation survives a message that could not be sent', ({ Given, When, Then, And }) => {
    let test: TestApp;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('an administrator "ana@example.com" whose mail server will take nothing', async () => {
      ({ test, jar } = await administratorWithNoMailServer());
    });
    When('the administrator invites "nuevo@example.com"', async () => {
      response = await request(test.app, jar, {
        method: 'POST',
        url: '/admin/invites',
        payload: { email: INVITED },
      });
    });
    Then('inviting is not refused', () => {
      expect(response.statusCode).toBe(201);
    });
    And('an invitation for "nuevo@example.com" is pending', () => {
      expect(invitationRows(test.db, INVITED)).toHaveLength(1);
    });
    And('the administrator is told the message did not go out', () => {
      expect(response.json().messageSent).toBe(false);
    });
  });

  Scenario('A failed handoff offers the link, once', ({ Given, When, Then, And }) => {
    let test: TestApp;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('an administrator "ana@example.com" whose mail server will take nothing', async () => {
      ({ test, jar } = await administratorWithNoMailServer());
    });
    When('the administrator invites "nuevo@example.com"', async () => {
      response = await request(test.app, jar, {
        method: 'POST',
        url: '/admin/invites',
        payload: { email: INVITED },
      });
    });
    Then('the link is offered to that administrator', () => {
      expect(response.json().link).toMatch(/^https?:\/\/.+\/.+$/);
    });
    And('the invited person can accept with it and become a host', async () => {
      const accepted = await acceptWith(test, tokenFromLink(response.json().link));
      expect(accepted.statusCode).toBe(201);
    });
  });

  Scenario('A successful handoff offers no link', ({ Given, When, Then }) => {
    let test: TestApp;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('an administrator "ana@example.com"', async () => {
      test = makeTestApp();
      jar = new CookieJar();
      await signInAsAdministrator(test.app, test.db, jar, 'ana@example.com');
    });
    When('the administrator invites "nuevo@example.com"', async () => {
      response = await request(test.app, jar, {
        method: 'POST',
        url: '/admin/invites',
        payload: { email: INVITED },
      });
    });
    Then('no link is offered to that administrator', () => {
      expect(response.json().messageSent).toBe(true);
      expect(response.json().link).toBeUndefined();
    });
  });

  Scenario('The link is still absent from the stored invitation when sending failed', ({ Given, When, Then }) => {
    let test: TestApp;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('an administrator "ana@example.com" whose mail server will take nothing', async () => {
      ({ test, jar } = await administratorWithNoMailServer());
    });
    When('the administrator invites "nuevo@example.com"', async () => {
      response = await request(test.app, jar, {
        method: 'POST',
        url: '/admin/invites',
        payload: { email: INVITED },
      });
    });
    Then('the stored invitation does not contain the link', () => {
      const token = tokenFromLink(response.json().link);
      expect(JSON.stringify(invitationRows(test.db, INVITED))).not.toContain(token);
    });
  });

  Scenario('A handed-off message is recorded as such', ({ Given, When, Then }) => {
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
    Then('the invitation records that its message went out', () => {
      expect(storedInvitation(test.db, INVITED)?.message_sent).toBe(1);
    });
  });

  Scenario('A message that could not be handed off is recorded as such', ({ Given, When, Then }) => {
    let test: TestApp;
    let jar: CookieJar;

    Given('an administrator "ana@example.com" whose mail server will take nothing', async () => {
      ({ test, jar } = await administratorWithNoMailServer());
    });
    When('the administrator invites "nuevo@example.com"', async () => {
      await request(test.app, jar, {
        method: 'POST',
        url: '/admin/invites',
        payload: { email: INVITED },
      });
    });
    Then('the invitation records that its message did not go out', () => {
      expect(storedInvitation(test.db, INVITED)?.message_sent).toBe(0);
    });
  });

  /*
   * A deployment configured to send nothing. Distinct from the failing-transport
   * scenarios above, which prove the flow copes when a send goes wrong: these
   * prove the *setting* selects that path deliberately, and that production is
   * willing to boot that way.
   */
  Scenario('A deployment that hands every invitation over by hand', ({ Given, When, Then, And }) => {
    let test: Omit<TestApp, 'mailer'>;
    let jar: CookieJar;
    let response: LightMyRequestResponse;

    Given('an administrator "ana@example.com" on a deployment that sends no mail', async () => {
      test = makeTestAppWithoutMail();
      jar = new CookieJar();
      await signInAsAdministrator(test.app, test.db, jar, 'ana@example.com');
    });
    When('the administrator invites "nuevo@example.com"', async () => {
      response = await request(test.app, jar, {
        method: 'POST',
        url: '/admin/invites',
        payload: { email: INVITED },
      });
    });
    Then('inviting is not refused', () => {
      expect(response.statusCode).toBe(201);
    });
    And('the link is offered to that administrator', () => {
      expect(response.json().messageSent).toBe(false);
      expect(response.json().link).toContain('/accept-invite/');
    });
    And('the invited person can accept with it and become a host', async () => {
      const accepted = await test.app.inject({
        method: 'POST',
        url: `/invites/${tokenFromLink(response.json().link)}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
      expect(accepted.statusCode).toBe(201);
    });
  });

  Scenario('A deployment that sends no mail says so about every invitation', ({ Given, When, Then }) => {
    let test: Omit<TestApp, 'mailer'>;
    let jar: CookieJar;

    Given('an administrator "ana@example.com" on a deployment that sends no mail', async () => {
      test = makeTestAppWithoutMail();
      jar = new CookieJar();
      await signInAsAdministrator(test.app, test.db, jar, 'ana@example.com');
    });
    When('the administrator invites "nuevo@example.com"', async () => {
      await request(test.app, jar, { method: 'POST', url: '/admin/invites', payload: { email: INVITED } });
    });
    Then('the invitation records that its message did not go out', () => {
      expect(storedInvitation(test.db, INVITED)?.message_sent).toBe(0);
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
