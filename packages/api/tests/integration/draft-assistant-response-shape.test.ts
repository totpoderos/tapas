import { describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { makeTestApp, seedHost } from '../support/test-server.js';
import type { LLMClient, LLMCompletion, LLMCompletionRequest } from '../../src/index.js';

/**
 * The assistant use cases report `diagnostics` (whether the model called a
 * tool, which fields failed re-validation) for logging and the eval harness.
 * That is internal telemetry about the model, not part of the host's API —
 * these tests pin the response shape so it cannot leak in by accident.
 */

class FakeLLMClient implements LLMClient {
  constructor(private readonly completion: LLMCompletion) {}
  async complete(_request: LLMCompletionRequest): Promise<LLMCompletion> {
    return this.completion;
  }
}

const PROPOSES_A_NAME: LLMCompletion = {
  text: '',
  toolCalls: [
    {
      name: 'propose_contest_draft',
      arguments: {
        name: { value: 'Summer Tapas', source: 'host' },
        clarifications: ['Who is participating?'],
      },
    },
  ],
};

const STRONG_PASSWORD = 'Str0ng!Passw0rd';

async function signedInCookie(app: FastifyInstance): Promise<string> {
  const jar = new Map<string, string>();
  const header = () => [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ');
  await seedHost(app, 'shape@example.com', STRONG_PASSWORD);
  for (const url of ['/auth/login']) {
    const response = await app.inject({
      method: 'POST',
      url,
      headers: { cookie: header() },
      payload: { email: 'shape@example.com', password: STRONG_PASSWORD },
    });
    for (const cookie of response.cookies) {
      if (cookie.value === '') jar.delete(cookie.name);
      else jar.set(cookie.name, cookie.value);
    }
  }
  return header();
}

describe('the assistant endpoints', () => {
  it('returns only the draft and its clarifications when extracting', async () => {
    const { app } = makeTestApp(undefined, {}, new FakeLLMClient(PROPOSES_A_NAME));
    const cookie = await signedInCookie(app);

    const response = await app.inject({
      method: 'POST',
      url: '/drafts/extract',
      headers: { cookie },
      payload: { message: 'A contest called Summer Tapas.' },
    });

    expect(Object.keys(response.json()).sort()).toEqual(['clarifications', 'draft']);

    await app.close();
  });

  it('returns only the draft and its clarifications when merging', async () => {
    const { app } = makeTestApp(undefined, {}, new FakeLLMClient(PROPOSES_A_NAME));
    const cookie = await signedInCookie(app);

    const response = await app.inject({
      method: 'POST',
      url: '/drafts/merge',
      headers: { cookie },
      payload: {
        draft: { name: { value: 'Summer Tapas', source: 'host' } },
        clarifications: ['Who is participating?'],
        message: 'Ana and Bob are cooking.',
      },
    });

    expect(Object.keys(response.json()).sort()).toEqual(['clarifications', 'draft']);

    await app.close();
  });
});
