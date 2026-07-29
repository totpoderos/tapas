import { makeTestApp, promoteToAdministrator, seedHost, type TestApp } from './test-server.js';
import type { Clock } from '../../src/index.js';

const STRONG_PASSWORD = 'Str0ng!Passw0rd';
const ADMINISTRATOR = 'ana@example.com';

/** The token as the invited person has it: out of the link in their message, nowhere else. */
export function tokenFromLink(link: string): string {
  return link.slice(link.lastIndexOf('/') + 1);
}

/**
 * Signs the seeded administrator in and hands back their cookie.
 *
 * A spec that advances the clock past an access token's fifteen minutes needs
 * this before acting as an administrator again — the session really has
 * expired, exactly as it would for a person coming back the next day. A
 * personal access token would not help: it carries host powers only.
 */
export async function signInAdministrator(test: TestApp): Promise<string> {
  const signedIn = await test.app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: ADMINISTRATOR, password: STRONG_PASSWORD },
  });
  const access = signedIn.cookies.find((cookie) => cookie.name === 'access_token');
  return `access_token=${access?.value ?? ''}`;
}

/**
 * Puts a fresh app in the state "an administrator has invited this address",
 * which is where most of the enrollment specs start. The token comes back out
 * of the sent message, the way its recipient would get it — never out of the
 * database, which only ever holds its hash.
 *
 * Pass a `MutableClock` to exercise the invitation's lifetime: the invitation
 * is issued at whatever time the clock reads here, and a spec advances it
 * afterwards rather than waiting a day.
 */
export async function invitationSentTo(
  email: string,
  clock?: Clock,
): Promise<{ test: TestApp; token: string; link: string; id: string; adminCookie: string }> {
  const test = makeTestApp(clock);
  await seedHost(test.app, ADMINISTRATOR, STRONG_PASSWORD);
  promoteToAdministrator(test.db, ADMINISTRATOR);

  const adminCookie = await signInAdministrator(test);

  const invited = await test.app.inject({
    method: 'POST',
    url: '/admin/invites',
    headers: { cookie: adminCookie },
    payload: { email },
  });

  const link = test.mailer.sent.at(-1)!.link;
  // The id is how an administrator names an invitation — they never see a token.
  return { test, token: tokenFromLink(link), link, id: invited.json().invitationId, adminCookie };
}
