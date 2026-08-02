import { fileURLToPath } from 'node:url';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp, seedHost } from '../support/test-server.js';
import type { LLMClient, LLMCompletion, LLMCompletionRequest } from '../../src/index.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./extracting-a-contest-draft.feature', import.meta.url)),
);

const STRONG_PASSWORD = 'Str0ng!Passw0rd';

/** Returns a canned completion — the real model lives only in the eval harnesses. */
class FakeLLMClient implements LLMClient {
  constructor(private readonly completion: LLMCompletion) {}
  async complete(_request: LLMCompletionRequest): Promise<LLMCompletion> {
    return this.completion;
  }
}

function toolCallCompletion(args: Record<string, unknown>): LLMCompletion {
  return { text: '', toolCalls: [{ name: 'propose_contest_draft', arguments: args }] };
}

async function signedInHost(app: FastifyInstance): Promise<string> {
  const jar = new Map<string, string>();
  const capture = (response: LightMyRequestResponse) => {
    for (const raw of response.cookies) {
      if (raw.value === '') jar.delete(raw.name);
      else jar.set(raw.name, raw.value);
    }
  };
  const header = () => [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');

  await seedHost(app, 'ana@example.com', STRONG_PASSWORD);
  capture(
    await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { cookie: header() },
      payload: { email: 'ana@example.com', password: STRONG_PASSWORD },
    }),
  );
  return header();
}

describeFeature(feature, ({ Scenario }) => {
  Scenario(
    'A complete message extracts a full draft with no clarifications needed',
    ({ Given, When, Then, And }) => {
      let app: FastifyInstance;
      let cookie: string;
      let response: LightMyRequestResponse;

      Given('a host message that fully describes a contest', async () => {
        const llmClient = new FakeLLMClient(
          toolCallCompletion({
            name: { value: 'Summer Tapas', source: 'host' },
            format: { value: 'solo', source: 'host' },
                        scoring: {
              value: {
                categories: [{ id: 'taste', name: 'Taste' }],
                range: { type: 'fixed', min: 1, max: 5 },
                uniquePerCategory: false,
              },
              source: 'llm_extracted',
            },
            participants: {
              value: [
                { id: 'ana', displayName: 'Ana' },
                { id: 'bob', displayName: 'Bob' },
              ],
              source: 'host',
            },
            closeRule: { value: { when: 'all_sent' }, source: 'llm_default' },
            revealStrategy: { value: { when: 'host_trigger' }, source: 'llm_default' },
            clarifications: [],
          }),
        );
        ({ app } = makeTestApp(undefined, {}, llmClient));
        cookie = await signedInHost(app);
      });
      When('the host asks the assistant to extract a draft from it', async () => {
        response = await app.inject({
          method: 'POST',
          url: '/drafts/extract',
          headers: { cookie },
          payload: { message: 'Summer Tapas, per person, couples barred, taste 1-5, Ana and Bob' },
        });
      });
      Then('the extracted draft includes every field, tagged with its source', () => {
        expect(response.statusCode).toBe(200);
        const { draft } = response.json();
        expect(draft.name).toEqual({ value: 'Summer Tapas', source: 'host' });
        expect(draft.participants.source).toBe('host');
        expect(draft.closeRule).toEqual({ value: { when: 'all_sent' }, source: 'llm_default' });
      });
      And('there are no clarifications', () => {
        expect(response.json().clarifications).toEqual([]);
      });
    },
  );

  Scenario(
    'A partial message extracts what it can and asks for the rest',
    ({ Given, When, Then, And }) => {
      let app: FastifyInstance;
      let cookie: string;
      let response: LightMyRequestResponse;

      Given('a host message that leaves out the participants', async () => {
        const llmClient = new FakeLLMClient(
          toolCallCompletion({
            name: { value: 'Summer Tapas', source: 'host' },
            format: { value: 'solo', source: 'host' },
            clarifications: ['I could not tell who is participating — please list them.'],
          }),
        );
        ({ app } = makeTestApp(undefined, {}, llmClient));
        cookie = await signedInHost(app);
      });
      When('the host asks the assistant to extract a draft from it', async () => {
        response = await app.inject({
          method: 'POST',
          url: '/drafts/extract',
          headers: { cookie },
          payload: { message: 'Summer Tapas, per person' },
        });
      });
      Then('the extracted draft includes what could be determined', () => {
        expect(response.statusCode).toBe(200);
        expect(response.json().draft.name).toEqual({ value: 'Summer Tapas', source: 'host' });
        expect(response.json().draft.participants).toBeUndefined();
      });
      And('the clarifications list asks for the participants', () => {
        expect(response.json().clarifications).toEqual([
          'I could not tell who is participating — please list them.',
        ]);
      });
    },
  );

  Scenario('The assistant may not default a high-stakes field', ({ Given, When, Then, And }) => {
    let app: FastifyInstance;
    let cookie: string;
    let response: LightMyRequestResponse;

    Given(
      "an assistant response that defaults the contest's format without the host having said so",
      async () => {
        const llmClient = new FakeLLMClient(
          toolCallCompletion({
            format: { value: 'solo', source: 'llm_default' },
            clarifications: [],
          }),
        );
        ({ app } = makeTestApp(undefined, {}, llmClient));
        cookie = await signedInHost(app);
      },
    );
    When('the draft is extracted', async () => {
      response = await app.inject({
        method: 'POST',
        url: '/drafts/extract',
        headers: { cookie },
        payload: { message: 'Some tapas contest' },
      });
    });
    Then('the format is dropped from the draft', () => {
      expect(response.json().draft.format).toBeUndefined();
    });
    And('a clarification asks the host to specify it', () => {
      expect(response.json().clarifications).toEqual([
        "Please specify the contest format explicitly — I can't default that for you.",
      ]);
    });
  });

  Scenario('Extraction requires being signed in', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let response: LightMyRequestResponse;

    Given('no one is signed in', () => {
      ({ app } = makeTestApp());
    });
    When('a draft extraction is attempted', async () => {
      response = await app.inject({
        method: 'POST',
        url: '/drafts/extract',
        payload: { message: 'Summer Tapas' },
      });
    });
    Then('it is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });
});
