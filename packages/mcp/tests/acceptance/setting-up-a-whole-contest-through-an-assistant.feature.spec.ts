import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { afterAll, expect } from 'vitest';
import { buildMcpServer } from '../../src/mcp-server.js';
import { hostWithToken, startApi, type RunningApi } from '../support/api-harness.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./setting-up-a-whole-contest-through-an-assistant.feature', import.meta.url)),
);

const SECRET = 'a-confirmation-secret-of-32-chars!!';

interface ToolResult {
  readonly isError?: boolean;
  readonly content: readonly { readonly type: string; readonly text: string }[];
}

interface NamedThing {
  readonly id?: string;
  readonly name?: string;
  readonly displayName?: string;
}

async function connectAssistant(apiBaseUrl: string, hostToken: string): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = buildMcpServer({ apiBaseUrl, hostToken, confirmationSecret: SECRET });
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-assistant', version: '0.0.0' });
  await client.connect(clientTransport);
  return client;
}

async function callTool(client: Client, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  return (await client.callTool({ name, arguments: args })) as ToolResult;
}

function body(result: ToolResult): Record<string, unknown> {
  const [block] = result.content;
  if (!block) throw new Error('tool result had no content');
  return JSON.parse(block.text) as Record<string, unknown>;
}

/**
 * What the assistant sends when a host describes a whole contest in one message:
 * everything named, nothing identified. An id is not the assistant's to invent —
 * the host has never been shown one — so none appears here.
 */
const NAMED_NOT_IDENTIFIED = {
  name: 'Tapas',
  format: 'solo',
  participants: [{ displayName: 'Carlos' }, { displayName: 'Alba' }, { displayName: 'Juan' }],
  scoring: {
    categories: [{ name: 'Taste' }, { name: 'Originality' }],
    range: { type: 'fixed', min: 1, max: 5 },
    uniquePerCategory: false,
  },
};

function draftOf(read: Record<string, unknown>): {
  categories: NamedThing[];
  participants: NamedThing[];
  scoring: Record<string, unknown>;
} {
  const content = read.content as Record<string, unknown>;
  const scoring = (content.scoring ?? {}) as Record<string, unknown>;
  return {
    categories: (scoring.categories ?? []) as NamedThing[],
    participants: (content.participants ?? []) as NamedThing[],
    scoring,
  };
}

/** Told apart: each has an identity of its own, and no two of them share one. */
function eachCanBeToldApart(things: NamedThing[]): void {
  expect(things.length).toBeGreaterThan(1);
  for (const thing of things) expect(thing.id).toBeTruthy();
  expect(new Set(things.map((thing) => thing.id)).size).toBe(things.length);
}

describeFeature(feature, ({ Scenario }) => {
  const started: RunningApi[] = [];
  const startTrackedApi = async (): Promise<RunningApi> => {
    const running = await startApi();
    started.push(running);
    return running;
  };
  afterAll(async () => {
    for (const running of started) await running.close();
  });

  const assistantForAHost = async (): Promise<Client> => {
    const api = await startTrackedApi();
    return connectAssistant(api.baseUrl, await hostWithToken(api.app, api.database, 'ana@example.com'));
  };

  Scenario('The assistant sets up a whole contest in one asking', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a personal access token', async () => {
      client = await assistantForAHost();
    });
    When(
      'the assistant is asked to set up a contest named "Tapas", judged on Taste and Originality, with Carlos, Alba and Juan taking part, scored from 1 to 5 with scores allowed to repeat',
      async () => {
        result = await callTool(client, 'create_draft', NAMED_NOT_IDENTIFIED);
      },
    );
    Then('a draft named "Tapas" is saved for the host', async () => {
      expect(result.isError).toBeFalsy();
      expect(body(await callTool(client, 'get_draft', { contest: 'Tapas' }))).toMatchObject({
        id: body(result).id,
      });
    });
    And('it is judged on Taste and Originality', async () => {
      const { categories } = draftOf(body(await callTool(client, 'get_draft', { contest: 'Tapas' })));
      expect(categories.map((category) => category.name)).toEqual(['Taste', 'Originality']);
    });
    And('Carlos, Alba and Juan are taking part', async () => {
      const { participants } = draftOf(body(await callTool(client, 'get_draft', { contest: 'Tapas' })));
      expect(participants.map((person) => person.displayName)).toEqual(['Carlos', 'Alba', 'Juan']);
    });
    And('it is scored from 1 to 5', async () => {
      const { scoring } = draftOf(body(await callTool(client, 'get_draft', { contest: 'Tapas' })));
      expect(scoring.range).toEqual({ type: 'fixed', min: 1, max: 5 });
    });
  });

  Scenario('What a contest is judged on is named, never identified', ({ Given, When, Then, And }) => {
    let client: Client;

    Given('a host with a personal access token', async () => {
      client = await assistantForAHost();
    });
    When('the assistant sets up a contest judged on Taste and Originality, naming them and nothing else', async () => {
      expect((await callTool(client, 'create_draft', NAMED_NOT_IDENTIFIED)).isError).toBeFalsy();
    });
    Then('the draft is judged on both of them', async () => {
      const { categories } = draftOf(body(await callTool(client, 'get_draft', { contest: 'Tapas' })));
      expect(categories.map((category) => category.name)).toEqual(['Taste', 'Originality']);
    });
    And('each can be told apart from the other', async () => {
      eachCanBeToldApart(draftOf(body(await callTool(client, 'get_draft', { contest: 'Tapas' }))).categories);
    });
  });

  /*
   * The honest test of whether two categories are two things. Publishing is
   * where a draft whose categories are one thing underneath is refused, so a
   * contest that goes live is one whose categories were really told apart —
   * rather than a test asserting the ids it just read.
   */
  Scenario('A contest set up that way can go live', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given(
      'a host with a contest set up through the assistant by naming everything and identifying nothing',
      async () => {
        client = await assistantForAHost();
        expect((await callTool(client, 'create_draft', NAMED_NOT_IDENTIFIED)).isError).toBeFalsy();
      },
    );
    When('the assistant publishes that draft with a valid confirmation', async () => {
      const confirmationToken = body(await callTool(client, 'publish_contest', { contest: 'Tapas' }))
        .confirmationToken as string;
      result = await callTool(client, 'publish_contest', { contest: 'Tapas', confirmationToken });
    });
    Then('the contest is live', async () => {
      expect(result.isError).toBeFalsy();
      expect(body(await callTool(client, 'get_contest', { contest: 'Tapas' }))).toMatchObject({ status: 'live' });
    });
    And('it is judged on two things', async () => {
      const details = body(await callTool(client, 'get_contest_details', { name: 'Tapas' }));
      expect(JSON.stringify(details)).toContain('Taste');
      expect(JSON.stringify(details)).toContain('Originality');
    });
  });

  Scenario('Who is taking part is named, never identified', ({ Given, When, Then, And }) => {
    let client: Client;

    Given('a host with a personal access token', async () => {
      client = await assistantForAHost();
    });
    When('the assistant sets up a contest with Carlos, Alba and Juan taking part, naming them and nothing else', async () => {
      expect((await callTool(client, 'create_draft', NAMED_NOT_IDENTIFIED)).isError).toBeFalsy();
    });
    Then('all three are taking part', async () => {
      const { participants } = draftOf(body(await callTool(client, 'get_draft', { contest: 'Tapas' })));
      expect(participants.map((person) => person.displayName)).toEqual(['Carlos', 'Alba', 'Juan']);
    });
    And('each can be told apart from the others', async () => {
      eachCanBeToldApart(draftOf(body(await callTool(client, 'get_draft', { contest: 'Tapas' }))).participants);
    });
  });
});
