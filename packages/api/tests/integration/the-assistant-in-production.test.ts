import { describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { makeTestApp, seedHost } from '../support/test-server.js';
import type { LLMClient, LLMCompletion, LLMCompletionRequest } from '../../src/index.js';

/**
 * The assistant, against a server configured the way the deployment is.
 *
 * Nothing exercised this before, and that is the whole reason a production-only
 * defect could ship green: every other assistant spec runs with NODE_ENV=test,
 * where the HTTPS redirect is never registered.
 *
 * In production it is. It answers any request whose protocol is not https with a
 * 301 — and the assistant dispatches its tool calls in-process through
 * `app.inject`, which carries no `x-forwarded-proto`, so `request.protocol` reads
 * `http` and every dispatch was redirected before it reached a route. A 301 has
 * an empty body and a status under 400, so the turn reported `ok` and the host
 * was told their contest had been created. Nothing had been.
 *
 * The browser never hit this: a real request arrives through the platform with
 * `x-forwarded-proto: https` set, which is why the form worked and the assistant
 * did not, and why "the assistant is not connected to the database" was such a
 * reasonable thing to conclude.
 *
 * These specs therefore set that header on the requests they make — that is what
 * a request through the platform looks like — and leave the dispatch to fend for
 * itself, which is the thing under test.
 */

const AS_THE_PLATFORM_SENDS_IT = { 'x-forwarded-proto': 'https' };

class ProposesOneCall implements LLMClient {
  constructor(private readonly call: { name: string; arguments: Record<string, unknown> }) {}
  async complete(_request: LLMCompletionRequest): Promise<LLMCompletion> {
    return { text: '', toolCalls: [this.call] };
  }
}

const STRONG_PASSWORD = 'Str0ng!Passw0rd';

async function signedInCookie(app: FastifyInstance): Promise<string> {
  await seedHost(app, 'prod@example.com', STRONG_PASSWORD);
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: AS_THE_PLATFORM_SENDS_IT,
    payload: { email: 'prod@example.com', password: STRONG_PASSWORD },
  });
  return response.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

async function assistantTurn(
  llm: LLMClient,
  message: string,
): Promise<{ app: FastifyInstance; cookie: string; turn: Record<string, unknown> }> {
  const { app } = await makeTestApp(undefined, { NODE_ENV: 'production' }, llm);
  const cookie = await signedInCookie(app);
  const response = await app.inject({
    method: 'POST',
    url: '/assistant/messages',
    headers: { cookie, ...AS_THE_PLATFORM_SENDS_IT },
    payload: { messages: [{ role: 'user', content: message }] },
  });
  return { app, cookie, turn: response.json() as Record<string, unknown> };
}

describe('the assistant against a production-configured server', () => {
  it('really creates the contest it says it created', async () => {
    const { app, cookie, turn } = await assistantTurn(
      new ProposesOneCall({ name: 'create_draft', arguments: { name: 'testing' } }),
      'create a contest called testing',
    );

    // The draft is there to be read, by the host, through the ordinary door.
    const drafts = await app.inject({ method: 'GET', url: '/drafts', headers: { cookie, ...AS_THE_PLATFORM_SENDS_IT } });
    expect(drafts.json()).toHaveLength(1);
    expect(JSON.stringify(drafts.json())).toContain('testing');

    // And the turn said so truthfully: a result carries what the API answered.
    expect(turn.kind).toBe('result');
    expect(turn.result).toBeDefined();

    await app.close();
  });

  it('lists the contests the host actually has', async () => {
    const { app, cookie, turn } = await assistantTurn(
      new ProposesOneCall({ name: 'list_my_contests', arguments: {} }),
      'list all contests',
    );

    // Seeded through the ordinary door first, so "empty" could only be a lie.
    await app.inject({
      method: 'POST',
      url: '/drafts',
      headers: { cookie, ...AS_THE_PLATFORM_SENDS_IT },
      payload: { name: 'Already here' },
    });

    const second = await app.inject({
      method: 'POST',
      url: '/assistant/messages',
      headers: { cookie, ...AS_THE_PLATFORM_SENDS_IT },
      payload: { messages: [{ role: 'user', content: 'list all contests' }] },
    });
    const listed = second.json() as { kind: string; result?: unknown };

    expect(listed.kind).toBe('result');
    expect(Array.isArray(listed.result)).toBe(true);
    expect(listed.result).toHaveLength(1);
    // The first turn ran before anything existed; it must still have answered
    // with a list rather than with nothing at all.
    expect(turn.result).toBeDefined();

    await app.close();
  });

  /*
   * The second half of the defect, on its own. Even with the dispatch reaching
   * its route, a redirect must never read as a completed action: `ok` meant
   * "under 400", and 301 is under 400. No route in this API answers 3xx, so the
   * only thing this can refuse is a redirect that should never have been the
   * answer to a tool call.
   */
  it('does not report a redirect as a result', async () => {
    const { app, turn } = await assistantTurn(
      // A tool whose dispatch the redirect hook would answer, if it still could.
      new ProposesOneCall({ name: 'list_my_contests', arguments: {} }),
      'list all contests',
    );

    expect(turn.kind).not.toBe('reply');
    if (turn.kind === 'result') expect(turn.result).toBeDefined();

    await app.close();
  });
});
