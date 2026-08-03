import { describe, expect, it } from 'vitest';
import { RegisterHost } from '../../../../src/index.js';
import { FakeHostAccountRepository, FakePasswordHasher } from '../support.js';

const STRONG = 'Str0ng!Passw0rd';

function makeRegisterHost() {
  const accounts = new FakeHostAccountRepository();
  let sequence = 0;
  const ids = { next: () => `host-${++sequence}` };
  return { registerHost: new RegisterHost({ accounts, hasher: new FakePasswordHasher(), ids }), accounts };
}

describe('RegisterHost', async () => {
  it('registers a host, storing a hashed password under the normalised email', async () => {
    const { registerHost, accounts } = makeRegisterHost();

    const registration = await registerHost.execute('Ana@Example.com', STRONG);

    expect(registration.ok).toBe(true);
    const stored = await accounts.findByEmail('ana@example.com');
    expect(stored?.passwordHash).toBe(`hashed:${STRONG}`);
  });

  it('rejects an invalid email', async () => {
    const { registerHost } = makeRegisterHost();
    const registration = await registerHost.execute('not-an-email', STRONG);
    expect(registration.ok).toBe(false);
    if (!registration.ok) expect(registration.error.code).toBe('INVALID_EMAIL');
  });

  it('rejects a weak password', async () => {
    const { registerHost } = makeRegisterHost();
    const registration = await registerHost.execute('ana@example.com', 'short');
    expect(registration.ok).toBe(false);
    if (!registration.ok) expect(registration.error.code).toBe('WEAK_PASSWORD');
  });

  it('rejects a duplicate email', async () => {
    const { registerHost } = makeRegisterHost();
    await registerHost.execute('ana@example.com', STRONG);
    const registration = await registerHost.execute('ana@example.com', STRONG);
    expect(registration.ok).toBe(false);
    if (!registration.ok) expect(registration.error.code).toBe('EMAIL_TAKEN');
  });
});
