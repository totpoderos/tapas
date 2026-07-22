import { fileURLToPath } from 'node:url';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { makeTestApp } from '../support/test-server.js';
import type { LLMClient, LLMCompletion, LLMCompletionRequest } from '../../src/index.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./merging-a-contest-draft.feature', import.meta.url)),
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

const ANA_AND_BOB = {
  value: [
    { id: 'ana', displayName: 'Ana' },
    { id: 'bob', displayName: 'Bob' },
  ],
  source: 'host',
};

async function signedInHost(app: FastifyInstance): Promise<string> {
  const jar = new Map<string, string>();
  const capture = (response: LightMyRequestResponse) => {
    for (const raw of response.cookies) {
      if (raw.value === '') jar.delete(raw.name);
      else jar.set(raw.name, raw.value);
    }
  };
  const header = () => [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');

  capture(
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'ana@example.com', password: STRONG_PASSWORD },
    }),
  );
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
    'A reply that answers every open clarification completes the draft',
    ({ Given, When, Then, And }) => {
      let app: FastifyInstance;
      let cookie: string;
      let response: LightMyRequestResponse;

      Given(
        'a partial draft missing the participants, with a clarification asking for them',
        async () => {
          const llmClient = new FakeLLMClient(
            toolCallCompletion({
              name: { value: 'Summer Tapas', source: 'host' },
              participants: ANA_AND_BOB,
              clarifications: [],
            }),
          );
          ({ app } = makeTestApp(undefined, {}, llmClient));
          cookie = await signedInHost(app);
        },
      );
      When('the host replies naming the participants', async () => {
        response = await app.inject({
          method: 'POST',
          url: '/drafts/merge',
          headers: { cookie },
          payload: {
            draft: { name: { value: 'Summer Tapas', source: 'host' } },
            clarifications: ['I could not tell who is participating — please list them.'],
            message: 'Ana and Bob are cooking.',
          },
        });
      });
      Then('the merged draft includes the participants', () => {
        expect(response.statusCode).toBe(200);
        expect(response.json().draft.participants).toEqual(ANA_AND_BOB);
      });
      And('there are no clarifications left', () => {
        expect(response.json().clarifications).toEqual([]);
      });
    },
  );

  Scenario(
    "A reply that answers only part of what's missing keeps asking for the rest",
    ({ Given, When, Then, And }) => {
      let app: FastifyInstance;
      let cookie: string;
      let response: LightMyRequestResponse;

      Given(
        'a partial draft missing both the participants and the scoring rules',
        async () => {
          const llmClient = new FakeLLMClient(
            toolCallCompletion({
              name: { value: 'Summer Tapas', source: 'host' },
              participants: ANA_AND_BOB,
              clarifications: ['How should dishes be scored?'],
            }),
          );
          ({ app } = makeTestApp(undefined, {}, llmClient));
          cookie = await signedInHost(app);
        },
      );
      When('the host replies naming only the participants', async () => {
        response = await app.inject({
          method: 'POST',
          url: '/drafts/merge',
          headers: { cookie },
          payload: {
            draft: { name: { value: 'Summer Tapas', source: 'host' } },
            clarifications: ['Who is participating?', 'How should dishes be scored?'],
            message: 'Ana and Bob are cooking.',
          },
        });
      });
      Then('the merged draft includes the participants', () => {
        expect(response.statusCode).toBe(200);
        expect(response.json().draft.participants).toEqual(ANA_AND_BOB);
      });
      And('the clarifications list still asks for the scoring rules', () => {
        expect(response.json().clarifications).toEqual(['How should dishes be scored?']);
      });
    },
  );

  Scenario(
    "Fields already known are kept even when the reply doesn't repeat them",
    ({ Given, When, Then }) => {
      let app: FastifyInstance;
      let cookie: string;
      let response: LightMyRequestResponse;

      Given('a partial draft with the contest name already set', async () => {
        const llmClient = new FakeLLMClient(
          toolCallCompletion({
            closeRule: { value: { when: 'all_sent' }, source: 'host' },
            clarifications: [],
          }),
        );
        ({ app } = makeTestApp(undefined, {}, llmClient));
        cookie = await signedInHost(app);
      });
      When('the host replies about an unrelated field', async () => {
        response = await app.inject({
          method: 'POST',
          url: '/drafts/merge',
          headers: { cookie },
          payload: {
            draft: { name: { value: 'Summer Tapas', source: 'host' } },
            clarifications: ['When should voting close?'],
            message: 'Close it once everyone has sent their votes.',
          },
        });
      });
      Then('the merged draft still includes the contest name', () => {
        expect(response.statusCode).toBe(200);
        expect(response.json().draft.name).toEqual({ value: 'Summer Tapas', source: 'host' });
      });
    },
  );

  Scenario(
    'The assistant may not default a high-stakes field while merging',
    ({ Given, When, Then, And }) => {
      let app: FastifyInstance;
      let cookie: string;
      let response: LightMyRequestResponse;

      Given(
        'a merge attempt that defaults the attribution field without the host having said so',
        async () => {
          const llmClient = new FakeLLMClient(
            toolCallCompletion({
              attribution: { value: 'per_person', source: 'llm_default' },
              clarifications: [],
            }),
          );
          ({ app } = makeTestApp(undefined, {}, llmClient));
          cookie = await signedInHost(app);
        },
      );
      When('the reply is merged', async () => {
        response = await app.inject({
          method: 'POST',
          url: '/drafts/merge',
          headers: { cookie },
          payload: {
            draft: { name: { value: 'Summer Tapas', source: 'host' } },
            clarifications: ['Who gets the credit for a dish?'],
            message: 'Whatever you think is best.',
          },
        });
      });
      Then('the attribution field is dropped from the draft', () => {
        expect(response.json().draft.attribution).toBeUndefined();
      });
      And('a clarification asks the host to specify it', () => {
        expect(response.json().clarifications).toEqual([
          "Please specify attribution explicitly — I can't default that for you.",
        ]);
      });
    },
  );

  Scenario('Merging a reply requires being signed in', ({ Given, When, Then }) => {
    let app: FastifyInstance;
    let response: LightMyRequestResponse;

    Given('no one is signed in', () => {
      ({ app } = makeTestApp());
    });
    When('a draft merge is attempted', async () => {
      response = await app.inject({
        method: 'POST',
        url: '/drafts/merge',
        payload: {
          draft: { name: { value: 'Summer Tapas', source: 'host' } },
          clarifications: [],
          message: 'Ana and Bob are cooking.',
        },
      });
    });
    Then('it is refused as not signed in', () => {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('NOT_SIGNED_IN');
    });
  });
});
