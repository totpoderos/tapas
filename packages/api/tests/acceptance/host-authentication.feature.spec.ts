import { DatabaseSync } from 'node:sqlite';
import { SqliteDatabase } from '../../src/db/sqlite-database.js';
import { fileURLToPath } from 'node:url';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import {
  AuthenticateHost,
  BcryptPasswordHasher,
  HmacJwtTokenIssuer,
  RegisterHost,
  runMigrations,
  SqliteHostAccountRepository,
  SqliteSessionStore,
  type Clock,
} from '../../src/index.js';

const feature = await loadFeature(fileURLToPath(new URL('./host-authentication.feature', import.meta.url)));

const STRONG_PASSWORD = 'Str0ng!Passw0rd';
const WRONG_PASSWORD = 'Wr0ng!Passw0rd';

async function makeAuthWorkspace() {
  const db = new DatabaseSync(':memory:');
  await runMigrations(new SqliteDatabase(db));
  const accounts = new SqliteHostAccountRepository(new SqliteDatabase(db));
  const hasher = new BcryptPasswordHasher(4); // low cost keeps tests fast
  const clock: Clock = { now: () => '2026-07-19T10:00:00.000Z' };
  const tokens = new HmacJwtTokenIssuer('test-secret-that-is-at-least-32-characters', clock);
  const sessions = new SqliteSessionStore(new SqliteDatabase(db));
  let sequence = 0;
  const ids = { next: () => `host-${++sequence}` };
  return {
    registerHost: new RegisterHost({ accounts, hasher, ids }),
    authenticateHost: new AuthenticateHost({ accounts, hasher, tokens, sessions, clock }),
    accounts,
  };
}

type AuthWorkspace = Awaited<ReturnType<typeof makeAuthWorkspace>>;

describeFeature(feature, ({ Scenario }) => {
  Scenario('A host registers and can log in', ({ Given, When, Then, And }) => {
    let workspace: AuthWorkspace;
    let registration: Awaited<ReturnType<RegisterHost['execute']>>;
    let loginOutcome: Awaited<ReturnType<AuthenticateHost['execute']>>;

    Given('no host is registered with "ana@example.com"', async () => void (workspace = await makeAuthWorkspace()));
    When('a host registers with email "ana@example.com" and a strong password', async () => {
      registration = await workspace.registerHost.execute('ana@example.com', STRONG_PASSWORD);
    });
    Then('the host account is created', () => {
      expect(registration.ok).toBe(true);
    });
    And('the host can log in with that email and password', async () => {
      loginOutcome = await workspace.authenticateHost.execute('ana@example.com', STRONG_PASSWORD);
      expect(loginOutcome.ok).toBe(true);
    });
    And('a session is issued', () => {
      if (!loginOutcome.ok) throw new Error('expected login success');
      expect(loginOutcome.session.accessToken).toBeTruthy();
      expect(loginOutcome.session.refreshToken).toBeTruthy();
    });
  });

  Scenario('The password is never stored in the clear', ({ Given, Then }) => {
    let workspace: AuthWorkspace;
    Given('a registered host with email "ana@example.com"', async () => {
      workspace = await makeAuthWorkspace();
      await workspace.registerHost.execute('ana@example.com', STRONG_PASSWORD);
    });
    Then('the stored credentials do not reveal the password', async () => {
      const account = await workspace.accounts.findByEmail('ana@example.com');
      expect(account?.passwordHash).toBeTruthy();
      expect(account?.passwordHash).not.toBe(STRONG_PASSWORD);
    });
  });

  Scenario('Logging in with the wrong password is refused', ({ Given, When, Then }) => {
    let workspace: AuthWorkspace;
    let loginOutcome: Awaited<ReturnType<AuthenticateHost['execute']>>;
    Given('a registered host with email "ana@example.com"', async () => {
      workspace = await makeAuthWorkspace();
      await workspace.registerHost.execute('ana@example.com', STRONG_PASSWORD);
    });
    When('the host tries to log in with the wrong password', async () => {
      loginOutcome = await workspace.authenticateHost.execute('ana@example.com', WRONG_PASSWORD);
    });
    Then('logging in is refused as invalid credentials', () => {
      expect(loginOutcome.ok).toBe(false);
      if (!loginOutcome.ok) expect(loginOutcome.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  Scenario('Logging in with an unknown email is refused the same way', ({ Given, When, Then }) => {
    let workspace: AuthWorkspace;
    let loginOutcome: Awaited<ReturnType<AuthenticateHost['execute']>>;
    Given('no host is registered with "nobody@example.com"', async () => void (workspace = await makeAuthWorkspace()));
    When('someone tries to log in with "nobody@example.com"', async () => {
      loginOutcome = await workspace.authenticateHost.execute('nobody@example.com', STRONG_PASSWORD);
    });
    Then('logging in is refused as invalid credentials', () => {
      expect(loginOutcome.ok).toBe(false);
      if (!loginOutcome.ok) expect(loginOutcome.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  Scenario('Registering a taken email is refused', ({ Given, When, Then }) => {
    let workspace: AuthWorkspace;
    let registration: Awaited<ReturnType<RegisterHost['execute']>>;
    Given('a registered host with email "ana@example.com"', async () => {
      workspace = await makeAuthWorkspace();
      await workspace.registerHost.execute('ana@example.com', STRONG_PASSWORD);
    });
    When('a host registers with email "ana@example.com" and a strong password', async () => {
      registration = await workspace.registerHost.execute('ana@example.com', STRONG_PASSWORD);
    });
    Then('registering is refused because the email is already taken', () => {
      expect(registration.ok).toBe(false);
      if (!registration.ok) expect(registration.error.code).toBe('EMAIL_TAKEN');
    });
  });

  Scenario('A weak password is refused', ({ Given, When, Then }) => {
    let workspace: AuthWorkspace;
    let registration: Awaited<ReturnType<RegisterHost['execute']>>;
    Given('no host is registered with "ana@example.com"', async () => void (workspace = await makeAuthWorkspace()));
    When('a host registers with email "ana@example.com" and the weak password "short"', async () => {
      registration = await workspace.registerHost.execute('ana@example.com', 'short');
    });
    Then('registering is refused because the password is too weak', () => {
      expect(registration.ok).toBe(false);
      if (!registration.ok) expect(registration.error.code).toBe('WEAK_PASSWORD');
    });
  });

  Scenario('The account locks after repeated failures', ({ Given, When, Then }) => {
    let workspace: AuthWorkspace;
    Given('a registered host with email "ana@example.com"', async () => {
      workspace = await makeAuthWorkspace();
      await workspace.registerHost.execute('ana@example.com', STRONG_PASSWORD);
    });
    When('the host fails to log in 5 times', async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        await workspace.authenticateHost.execute('ana@example.com', WRONG_PASSWORD);
      }
    });
    Then('logging in is locked, even with the correct password', async () => {
      const loginOutcome = await workspace.authenticateHost.execute('ana@example.com', STRONG_PASSWORD);
      expect(loginOutcome.ok).toBe(false);
      if (!loginOutcome.ok) expect(loginOutcome.error.code).toBe('ACCOUNT_LOCKED');
    });
  });
});
