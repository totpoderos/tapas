import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import {
  makeTestApp,
  MutableClock,
  promoteToAdministrator,
  type TestApp,
} from '../support/test-server.js';
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

/** Reads the security log straight from the app's own database. */
function securityLog(db: DatabaseSync): SecurityEvent[] {
  return new SqliteSecurityEventLog(db, new SystemClock(), new UuidIdGenerator()).list();
}

async function register(app: FastifyInstance, email: string): Promise<void> {
  await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: STRONG_PASSWORD },
  });
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
