import { describe, expect, it } from 'vitest';
import { AuthenticateHost, RegisterHost, type Clock } from '../../../../src/index.js';
import {
  FakeHostAccountRepository,
  FakePasswordHasher,
  FakeSessionStore,
  FakeTokenIssuer,
} from '../support.js';

const STRONG = 'Str0ng!Passw0rd';
const WRONG = 'Wr0ng!Passw0rd';

function makeAuthEnv() {
  const accounts = new FakeHostAccountRepository();
  const hasher = new FakePasswordHasher();
  const clock: Clock = { now: () => '2026-07-19T10:00:00.000Z' };
  let sequence = 0;
  const ids = { next: () => `host-${++sequence}` };
  const sessions = new FakeSessionStore();
  return {
    registerHost: new RegisterHost({ accounts, hasher, ids }),
    authenticateHost: new AuthenticateHost({
      accounts,
      hasher,
      tokens: new FakeTokenIssuer(),
      sessions,
      clock,
    }),
    accounts,
    sessions,
  };
}

describe('AuthenticateHost', async () => {
  it('issues a session for correct credentials and activates it', async () => {
    const { registerHost, authenticateHost, sessions } = makeAuthEnv();
    await registerHost.execute('ana@example.com', STRONG);

    const loginOutcome = await authenticateHost.execute('ana@example.com', STRONG);

    expect(loginOutcome.ok).toBe(true);
    if (loginOutcome.ok) {
      expect(loginOutcome.session.accessToken).toBe('access-token');
      expect(await sessions.isActive(loginOutcome.session.sessionId)).toBe(true);
    }
  });

  it('refuses a wrong password generically, but records the true reason internally', async () => {
    const { registerHost, authenticateHost, accounts } = makeAuthEnv();
    const registration = await registerHost.execute('ana@example.com', STRONG);

    const loginOutcome = await authenticateHost.execute('ana@example.com', WRONG);

    expect(loginOutcome.ok).toBe(false);
    if (!loginOutcome.ok) {
      expect(loginOutcome.error.code).toBe('INVALID_CREDENTIALS'); // generic to the caller
      expect(loginOutcome.logReason).toBe('bad_password'); // truthful to the log
      if (registration.ok) expect(loginOutcome.hostId).toBe(registration.hostId);
    }
    expect((await accounts.findByEmail('ana@example.com'))?.failedAttempts).toBe(1);
  });

  it('refuses an unknown email with the same generic error, logged as an unknown account', async () => {
    const { authenticateHost } = makeAuthEnv();
    const loginOutcome = await authenticateHost.execute('nobody@example.com', STRONG);
    expect(loginOutcome.ok).toBe(false);
    if (!loginOutcome.ok) {
      expect(loginOutcome.error.code).toBe('INVALID_CREDENTIALS'); // indistinguishable from a wrong password
      expect(loginOutcome.logReason).toBe('unknown_account');
      expect(loginOutcome.hostId).toBeNull(); // no account to attribute it to
    }
  });

  it('locks after 5 failures and then refuses even the correct password', async () => {
    const { registerHost, authenticateHost } = makeAuthEnv();
    await registerHost.execute('ana@example.com', STRONG);
    for (let attempt = 0; attempt < 5; attempt++) {
      await authenticateHost.execute('ana@example.com', WRONG);
    }

    const loginOutcome = await authenticateHost.execute('ana@example.com', STRONG);

    expect(loginOutcome.ok).toBe(false);
    if (!loginOutcome.ok) expect(loginOutcome.error.code).toBe('ACCOUNT_LOCKED');
  });
});
