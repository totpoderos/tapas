import { describe, expect, it } from 'vitest';
import { makeTestApp, seedHost } from '../../support/test-server.js';

/**
 * Twenty-two acceptance specs get their host this way, so the fixture itself is
 * worth one test: a seeded host must be able to sign in through the ordinary
 * path, or every spec leaning on it is built on a guess.
 */
describe('seedHost', () => {
  it('gives a host an account they can sign in with', async () => {
    const { app } = makeTestApp();
    await seedHost(app, 'ana@example.com', 'Str0ng!Passw0rd');

    const signedIn = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ana@example.com', password: 'Str0ng!Passw0rd' },
    });

    expect(signedIn.statusCode).toBe(200);
  });

  it('does not store the password as given', async () => {
    const { app, db } = makeTestApp();
    await seedHost(app, 'ana@example.com', 'Str0ng!Passw0rd');

    const row = db
      .prepare('SELECT password_hash FROM host_accounts WHERE email = ?')
      .get('ana@example.com') as { password_hash: string };

    expect(row.password_hash).not.toContain('Str0ng!Passw0rd');
  });

  it('can seed an administrator too', async () => {
    const { app, db } = makeTestApp();
    await seedHost(app, 'ana@example.com', 'Str0ng!Passw0rd', 'admin');

    const row = db
      .prepare('SELECT role FROM host_accounts WHERE email = ?')
      .get('ana@example.com') as { role: string };

    expect(row.role).toBe('admin');
  });
});
