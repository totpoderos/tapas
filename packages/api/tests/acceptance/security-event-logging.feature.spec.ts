import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { MutableClock, makeTestApp, promoteToAdministrator, seedHost, type TestApp } from '../support/test-server.js';
import { invitationSentTo } from '../support/invitations.js';
import {
  SqliteSecurityEventLog,
  SystemClock,
  UuidIdGenerator,
  type SecurityEvent,
} from '../../src/index.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./security-event-logging.feature', import.meta.url)),
);

const STRONG_PASSWORD = 'Str0ng!Passw0rd';
const WRONG_PASSWORD = 'Wr0ng!Passw0rd';
const OPERATOR = 'operator@example.com';

/** Reads the security log straight from the app's own database. */
function securityLog(db: DatabaseSync): SecurityEvent[] {
  return new SqliteSecurityEventLog(db, new SystemClock(), new UuidIdGenerator()).list();
}

async function register(app: FastifyInstance, email: string): Promise<void> {
  await seedHost(app, email, STRONG_PASSWORD);
}

async function login(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } });
}

function readCookie(response: LightMyRequestResponse, name: string): string {
  const cookie = response.cookies.find((c) => c.name === name);
  return cookie ? `${name}=${cookie.value}` : '';
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('A successful sign-in is recorded', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;

    Given('a registered host "ana@example.com"', async () => {
      ({ app, db } = makeTestApp());
      await register(app, 'ana@example.com');
    });
    When('that host signs in through the API', async () => {
      await login(app, 'ana@example.com', STRONG_PASSWORD);
    });
    Then('the security log records a successful sign-in for that host', () => {
      const events = securityLog(db);
      const signIn = events.find((event) => event.type === 'sign_in.succeeded');
      expect(signIn).toBeTruthy();
      expect(signIn?.actorId).toBeTruthy();
      expect(signIn?.sourceIp).toBeTruthy();
    });
  });

  Scenario('A refused sign-in is recorded with its reason', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;

    Given('a registered host "ana@example.com"', async () => {
      ({ app, db } = makeTestApp());
      await register(app, 'ana@example.com');
    });
    When('a sign-in is attempted for "ana@example.com" with the wrong password', async () => {
      await login(app, 'ana@example.com', WRONG_PASSWORD);
    });
    Then('the security log records a refused sign-in noting the credentials were invalid', () => {
      const refused = securityLog(db).find((event) => event.type === 'sign_in.refused');
      expect(refused?.reason).toBe('bad_password');
    });
  });

  Scenario(
    'A refused sign-in for an unknown account is still recorded',
    ({ Given, When, Then }) => {
      let app: FastifyInstance;
      let db: DatabaseSync;

      Given('no host is registered with "nobody@example.com"', () => {
        ({ app, db } = makeTestApp());
      });
      When('a sign-in is attempted for "nobody@example.com"', async () => {
        await login(app, 'nobody@example.com', STRONG_PASSWORD);
      });
      Then('the security log records a refused sign-in for an unknown account', () => {
        const refused = securityLog(db).find((event) => event.type === 'sign_in.refused');
        expect(refused?.reason).toBe('unknown_account');
        expect(refused?.actorId).toBeNull();
      });
    },
  );

  Scenario('The security log never stores the attempted password', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;

    Given('a registered host "ana@example.com"', async () => {
      ({ app, db } = makeTestApp());
      await register(app, 'ana@example.com');
    });
    When('a sign-in is attempted for "ana@example.com" with the wrong password', async () => {
      await login(app, 'ana@example.com', WRONG_PASSWORD);
    });
    Then('no security log entry contains the attempted password', () => {
      const serialized = JSON.stringify(securityLog(db));
      expect(serialized).not.toContain(WRONG_PASSWORD);
    });
  });

  Scenario('Issuing a personal access token is recorded', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let cookie: string;

    Given('a signed-in host "ana@example.com"', async () => {
      ({ app, db } = makeTestApp());
      await register(app, 'ana@example.com');
      cookie = readCookie(await login(app, 'ana@example.com', STRONG_PASSWORD), 'access_token');
    });
    When('that host issues a personal access token', async () => {
      await app.inject({ method: 'POST', url: '/auth/pats', headers: { cookie } });
    });
    Then('the security log records that a token was issued for that host', () => {
      const issued = securityLog(db).find((event) => event.type === 'pat.issued');
      expect(issued?.actorId).toBeTruthy();
    });
  });

  Scenario('Using a personal access token is recorded', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let token: string;

    Given('a signed-in host "ana@example.com" who has issued a personal access token', async () => {
      ({ app, db } = makeTestApp());
      await register(app, 'ana@example.com');
      const cookie = readCookie(
        await login(app, 'ana@example.com', STRONG_PASSWORD),
        'access_token',
      );
      const issued = await app.inject({ method: 'POST', url: '/auth/pats', headers: { cookie } });
      token = issued.json().token;
    });
    When('an external client acts as that host using the token', async () => {
      await app.inject({
        method: 'POST',
        url: '/drafts',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Tapas Night' },
      });
    });
    Then('the security log records that the token was used', () => {
      const used = securityLog(db).find((event) => event.type === 'pat.used');
      expect(used?.actorId).toBeTruthy();
    });
  });

  Scenario('The security log never stores a full token', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let cookie: string;
    let token: string;

    Given('a signed-in host "ana@example.com"', async () => {
      ({ app, db } = makeTestApp());
      await register(app, 'ana@example.com');
      cookie = readCookie(await login(app, 'ana@example.com', STRONG_PASSWORD), 'access_token');
    });
    When('that host issues a personal access token', async () => {
      const issued = await app.inject({ method: 'POST', url: '/auth/pats', headers: { cookie } });
      token = issued.json().token;
    });
    Then('no security log entry contains the full token', () => {
      const serialized = JSON.stringify(securityLog(db));
      expect(serialized).not.toContain(token);
    });
  });

  Scenario('A host refused administrative work is recorded', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let cookie: string;

    Given('a signed-in host "bob@example.com"', async () => {
      ({ app, db } = makeTestApp());
      await register(app, 'bob@example.com');
      cookie = readCookie(await login(app, 'bob@example.com', STRONG_PASSWORD), 'access_token');
    });
    When('that host is refused administrative work', async () => {
      const response = await app.inject({ method: 'GET', url: '/admin/hosts', headers: { cookie } });
      expect(response.statusCode).toBe(403);
    });
    Then('the security log records a refused administrative attempt for that host', () => {
      const refused = securityLog(db).find((event) => event.type === 'admin_access.refused');
      expect(refused?.actorId).toBeTruthy();
      expect(refused?.sourceIp).toBeTruthy();
    });
  });

  Scenario('A token refused administrative work is recorded', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let token: string;

    Given('an administrator "ana@example.com" who has issued a personal access token', async () => {
      ({ app, db } = makeTestApp());
      await register(app, 'ana@example.com');
      promoteToAdministrator(db, 'ana@example.com');
      const cookie = readCookie(
        await login(app, 'ana@example.com', STRONG_PASSWORD),
        'access_token',
      );
      const issued = await app.inject({ method: 'POST', url: '/auth/pats', headers: { cookie } });
      token = issued.json().token;
    });
    When('an external client using that token is refused administrative work', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/hosts',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(403);
    });
    Then(
      'the security log records a refused administrative attempt for that administrator',
      () => {
        const refused = securityLog(db).find((event) => event.type === 'admin_access.refused');
        expect(refused?.actorId).toBeTruthy();
      },
    );
  });

  Scenario('Administrative work that succeeds is not noise in the log', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let cookie: string;

    Given('an administrator "ana@example.com"', async () => {
      ({ app, db } = makeTestApp());
      await register(app, 'ana@example.com');
      promoteToAdministrator(db, 'ana@example.com');
      cookie = readCookie(await login(app, 'ana@example.com', STRONG_PASSWORD), 'access_token');
    });
    When('that administrator does administrative work successfully', async () => {
      const response = await app.inject({ method: 'GET', url: '/admin/hosts', headers: { cookie } });
      expect(response.statusCode).toBe(200);
    });
    Then('no refused administrative attempt is recorded', () => {
      const refused = securityLog(db).find((event) => event.type === 'admin_access.refused');
      expect(refused).toBeUndefined();
    });
  });

  Scenario('Issuing an invitation is recorded', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;
    let cookie: string;

    Given('an administrator "ana@example.com"', async () => {
      ({ app, db } = makeTestApp());
      await register(app, 'ana@example.com');
      promoteToAdministrator(db, 'ana@example.com');
      cookie = readCookie(await login(app, 'ana@example.com', STRONG_PASSWORD), 'access_token');
    });
    When('that administrator invites "nuevo@example.com"', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/admin/invites',
        headers: { cookie },
        payload: { email: 'nuevo@example.com' },
      });
      expect(response.statusCode).toBe(201);
    });
    Then('the security log records an invitation issued by that administrator', () => {
      const issued = securityLog(db).find((event) => event.type === 'invitation.issued');
      expect(issued?.actorId).toBeTruthy();
      expect(issued?.sourceIp).toBeTruthy();
    });
  });

  Scenario('Accepting an invitation is recorded', ({ Given, When, Then }) => {
    let test: TestApp;
    let token: string;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      ({ test, token } = await invitationSentTo('nuevo@example.com'));
    });
    When('the invited person accepts with a strong password', async () => {
      const response = await test.app.inject({
        method: 'POST',
        url: `/invites/${token}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
      expect(response.statusCode).toBe(201);
    });
    Then('the security log records the invitation accepted', () => {
      const accepted = securityLog(test.db).find((event) => event.type === 'invitation.accepted');
      expect(accepted?.sourceIp).toBeTruthy();
    });
  });

  Scenario('A refused acceptance is recorded', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let db: DatabaseSync;

    Given('an administrator "ana@example.com"', async () => {
      ({ app, db } = makeTestApp());
      await register(app, 'ana@example.com');
      promoteToAdministrator(db, 'ana@example.com');
    });
    When('someone tries to accept with a link that no invitation ever had', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/invites/a-token-nobody-ever-issued/accept',
        payload: { password: STRONG_PASSWORD },
      });
      expect(response.statusCode).toBe(404);
    });
    Then('the security log records a refused acceptance', () => {
      const refused = securityLog(db).find((event) => event.type === 'invitation.refused');
      expect(refused?.sourceIp).toBeTruthy();
    });
  });

  Scenario('A refusal for an expired link is recorded as an expiry', ({ Given, When, Then }) => {
    let test: TestApp;
    let token: string;
    let clock: MutableClock;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      clock = new MutableClock('2026-07-29T10:00:00.000Z');
      ({ test, token } = await invitationSentTo('nuevo@example.com', clock));
    });
    When('more than 24 hours pass and the invited person tries to accept', async () => {
      clock.advance(24 * 60 * 60 * 1000 + 1000);
      const response = await test.app.inject({
        method: 'POST',
        url: `/invites/${token}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
      expect(response.statusCode).toBe(404);
    });
    Then('the security log records a refused acceptance noting the link had expired', () => {
      const refused = securityLog(test.db).find((event) => event.type === 'invitation.refused');
      expect(refused?.reason).toBe('expired');
    });
  });

  Scenario('Revoking an invitation is recorded', ({ Given, When, Then }) => {
    let sent: Awaited<ReturnType<typeof invitationSentTo>>;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo('nuevo@example.com');
    });
    When('the administrator revokes it', async () => {
      const revoked = await sent.test.app.inject({
        method: 'POST',
        url: `/admin/invites/${sent.id}/revoke`,
        headers: { cookie: sent.adminCookie },
      });
      expect(revoked.statusCode).toBe(200);
    });
    Then('the security log records that invitation revoked by that administrator', () => {
      const event = securityLog(sent.test.db).find((e) => e.type === 'invitation.revoked');
      expect(event?.actorId).toBeTruthy();
      expect(event?.sourceIp).toBeTruthy();
    });
  });

  Scenario('Resending an invitation is recorded', ({ Given, When, Then }) => {
    let sent: Awaited<ReturnType<typeof invitationSentTo>>;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo('nuevo@example.com');
    });
    When('the administrator resends it', async () => {
      const resent = await sent.test.app.inject({
        method: 'POST',
        url: `/admin/invites/${sent.id}/resend`,
        headers: { cookie: sent.adminCookie },
      });
      expect(resent.statusCode).toBe(201);
    });
    Then('the security log records that invitation resent by that administrator', () => {
      const event = securityLog(sent.test.db).find((e) => e.type === 'invitation.resent');
      expect(event?.actorId).toBeTruthy();
    });
  });

  Scenario('Neither record contains a link', ({ Given, When, Then }) => {
    let sent: Awaited<ReturnType<typeof invitationSentTo>>;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo('nuevo@example.com');
    });
    When('the administrator resends it', async () => {
      await sent.test.app.inject({
        method: 'POST',
        url: `/admin/invites/${sent.id}/resend`,
        headers: { cookie: sent.adminCookie },
      });
    });
    Then("no security log entry contains either invitation's link", () => {
      const serialized = JSON.stringify(securityLog(sent.test.db));
      for (const message of sent.test.mailer.sent) {
        const token = message.link.slice(message.link.lastIndexOf('/') + 1);
        expect(serialized).not.toContain(token);
      }
    });
  });

  Scenario('A refusal for a revoked link is recorded as a revocation', ({ Given, When, Then }) => {
    let sent: Awaited<ReturnType<typeof invitationSentTo>>;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo('nuevo@example.com');
    });
    When('the administrator revokes it and the invited person tries to accept', async () => {
      await sent.test.app.inject({
        method: 'POST',
        url: `/admin/invites/${sent.id}/revoke`,
        headers: { cookie: sent.adminCookie },
      });
      const refused = await sent.test.app.inject({
        method: 'POST',
        url: `/invites/${sent.token}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
      expect(refused.statusCode).toBe(404);
    });
    Then('the security log records a refused acceptance noting the link had been revoked', () => {
      const event = securityLog(sent.test.db).find((e) => e.type === 'invitation.refused');
      expect(event?.reason).toBe('revoked');
    });
  });

  Scenario('A refusal for a superseded link is recorded as such', ({ Given, When, Then }) => {
    let sent: Awaited<ReturnType<typeof invitationSentTo>>;

    Given('an invitation was sent to "nuevo@example.com"', async () => {
      sent = await invitationSentTo('nuevo@example.com');
    });
    When('the administrator resends it and the invited person tries the original link', async () => {
      await sent.test.app.inject({
        method: 'POST',
        url: `/admin/invites/${sent.id}/resend`,
        headers: { cookie: sent.adminCookie },
      });
      const refused = await sent.test.app.inject({
        method: 'POST',
        url: `/invites/${sent.token}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
      expect(refused.statusCode).toBe(404);
    });
    Then('the security log records a refused acceptance noting the link had been superseded', () => {
      const event = securityLog(sent.test.db).find((e) => e.type === 'invitation.refused');
      expect(event?.reason).toBe('superseded');
    });
  });

  Scenario('Claiming an unclaimed deployment is recorded', ({ Given, When, Then }) => {
    let test: TestApp;

    Given('a deployment configured for "operator@example.com" with no administrator', () => {
      test = makeTestApp(undefined, { ADMIN_BOOTSTRAP_EMAIL: OPERATOR });
    });
    When('"operator@example.com" claims it', async () => {
      const claimed = await test.app.inject({
        method: 'POST',
        url: '/setup/admin',
        payload: { email: OPERATOR },
      });
      expect(claimed.statusCode).toBe(201);
    });
    Then('the security log records that the deployment was claimed', () => {
      const event = securityLog(test.db).find((e) => e.type === 'admin_bootstrap.claimed');
      expect(event?.sourceIp).toBeTruthy();
    });
  });

  Scenario('Becoming the administrator is recorded', ({ Given, When, Then }) => {
    let test: TestApp;

    Given('a deployment configured for "operator@example.com" with no administrator', () => {
      test = makeTestApp(undefined, { ADMIN_BOOTSTRAP_EMAIL: OPERATOR });
    });
    When('"operator@example.com" claims it and accepts with a strong password', async () => {
      await test.app.inject({ method: 'POST', url: '/setup/admin', payload: { email: OPERATOR } });
      const link = test.mailer.sent.at(-1)!.link;
      const accepted = await test.app.inject({
        method: 'POST',
        url: `/invites/${link.slice(link.lastIndexOf('/') + 1)}/accept`,
        payload: { password: STRONG_PASSWORD },
      });
      expect(accepted.statusCode).toBe(201);
    });
    Then("the security log records that the deployment's administrator was created", () => {
      const event = securityLog(test.db).find((e) => e.type === 'admin_bootstrap.completed');
      expect(event?.actorId).toBeTruthy();
    });
  });

  Scenario('A claim from the wrong address is recorded', ({ Given, When, Then, And }) => {
    let test: TestApp;

    Given('a deployment configured for "operator@example.com" with no administrator', () => {
      test = makeTestApp(undefined, { ADMIN_BOOTSTRAP_EMAIL: OPERATOR });
    });
    When('"someone-else@example.com" tries to claim it', async () => {
      const refused = await test.app.inject({
        method: 'POST',
        url: '/setup/admin',
        payload: { email: 'someone-else@example.com' },
      });
      expect(refused.statusCode).toBe(403);
    });
    Then('the security log records a refused claim', () => {
      const event = securityLog(test.db).find((e) => e.type === 'admin_bootstrap.refused');
      expect(event?.sourceIp).toBeTruthy();
    });
    And('no security log entry reveals "operator@example.com"', () => {
      expect(JSON.stringify(securityLog(test.db))).not.toContain(OPERATOR);
    });
  });

  Scenario('A message that could not be sent is recorded', ({ Given, When, Then, And }) => {
    let test: TestApp;
    let cookie: string;
    let link: string;

    Given('an administrator "ana@example.com" whose mail server will take nothing', async () => {
      test = makeTestApp();
      await register(test.app, 'ana@example.com');
      promoteToAdministrator(test.db, 'ana@example.com');
      cookie = readCookie(
        await login(test.app, 'ana@example.com', STRONG_PASSWORD),
        'access_token',
      );
      test.mailer.failEverySend();
    });
    When('that administrator invites "nuevo@example.com"', async () => {
      const invited = await test.app.inject({
        method: 'POST',
        url: '/admin/invites',
        headers: { cookie },
        payload: { email: 'nuevo@example.com' },
      });
      expect(invited.statusCode).toBe(201);
      link = invited.json().link;
    });
    Then('the security log records that the message did not go out', () => {
      const event = securityLog(test.db).find((e) => e.type === 'invitation.not_sent');
      expect(event?.actorId).toBeTruthy();
      expect(event?.sourceIp).toBeTruthy();
    });
    And("no security log entry contains that invitation's link", () => {
      const token = link.slice(link.lastIndexOf('/') + 1);
      expect(JSON.stringify(securityLog(test.db))).not.toContain(token);
    });
  });

  Scenario('A message that was sent is not noise in the log', ({ Given, When, Then }) => {
    let test: TestApp;
    let cookie: string;

    Given('an administrator "ana@example.com"', async () => {
      test = makeTestApp();
      await register(test.app, 'ana@example.com');
      promoteToAdministrator(test.db, 'ana@example.com');
      cookie = readCookie(
        await login(test.app, 'ana@example.com', STRONG_PASSWORD),
        'access_token',
      );
    });
    When('that administrator invites "nuevo@example.com"', async () => {
      await test.app.inject({
        method: 'POST',
        url: '/admin/invites',
        headers: { cookie },
        payload: { email: 'nuevo@example.com' },
      });
    });
    Then('no failed-message entry is recorded', () => {
      expect(securityLog(test.db).find((e) => e.type === 'invitation.not_sent')).toBeUndefined();
    });
  });

  Scenario(
    'A refusal for an unknown link is not recorded as an expiry',
    ({ Given, When, Then }) => {
      let app: FastifyInstance;
      let db: DatabaseSync;

      Given('an administrator "ana@example.com"', async () => {
        ({ app, db } = makeTestApp());
        await register(app, 'ana@example.com');
        promoteToAdministrator(db, 'ana@example.com');
      });
      When('someone tries to accept with a link that no invitation ever had', async () => {
        await app.inject({
          method: 'POST',
          url: '/invites/a-token-nobody-ever-issued/accept',
          payload: { password: STRONG_PASSWORD },
        });
      });
      Then('the security log does not describe that refusal as an expiry', () => {
        const refused = securityLog(db).find((event) => event.type === 'invitation.refused');
        expect(refused).toBeTruthy();
        expect(refused?.reason).not.toBe('expired');
      });
    },
  );

  Scenario("The security log never stores the link", ({ Given, When, Then }) => {
    let test: TestApp;
    let link: string;

    Given('an administrator "ana@example.com"', async () => {
      test = makeTestApp();
      await register(test.app, 'ana@example.com');
      promoteToAdministrator(test.db, 'ana@example.com');
    });
    When('that administrator invites "nuevo@example.com"', async () => {
      const cookie = readCookie(
        await login(test.app, 'ana@example.com', STRONG_PASSWORD),
        'access_token',
      );
      await test.app.inject({
        method: 'POST',
        url: '/admin/invites',
        headers: { cookie },
        payload: { email: 'nuevo@example.com' },
      });
      link = test.mailer.sent.at(-1)!.link;
    });
    Then("no security log entry contains that invitation's link", () => {
      const serialized = JSON.stringify(securityLog(test.db));
      expect(serialized).not.toContain(link.slice(link.lastIndexOf('/') + 1));
    });
  });
});
