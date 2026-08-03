import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { afterAll, expect } from 'vitest';
import { buildMcpServer } from '../../src/mcp-server.js';
import { hostWithDraft, hostWithToken, startApi, type RunningApi } from '../support/api-harness.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./authoring-a-contest-through-an-assistant.feature', import.meta.url)),
);

const SECRET = 'a-confirmation-secret-of-32-chars!!';

interface ToolResult {
  readonly isError?: boolean;
  readonly content: readonly { readonly type: string; readonly text: string }[];
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

  Scenario('The assistant creates a draft for the host', ({ Given, When, Then }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a personal access token', async () => {
      const api = await startTrackedApi();
      client = await connectAssistant(api.baseUrl, await hostWithToken(api.app, api.database, 'ana@example.com'));
    });
    When('the assistant is asked to create a draft named "Summer Tapas"', async () => {
      result = await callTool(client, 'create_draft', { name: 'Summer Tapas' });
    });
    Then('a draft named "Summer Tapas" is saved for the host', async () => {
      expect(result.isError).toBeFalsy();
      const created = body(result);
      // Read it back through the surface to prove it persisted.
      const reread = body(await callTool(client, 'get_draft', { contest: 'Summer Tapas' }));
      expect(reread).toMatchObject({ id: created.id });
      expect(JSON.stringify(reread)).toContain('Summer Tapas');
    });
  });

  Scenario('The assistant renames a draft', ({ Given, When, Then }) => {
    let client: Client;

    Given('a host with a saved draft', async () => {
      const api = await startTrackedApi();
      const host = await hostWithDraft(api.app, api.database, 'ana@example.com');
      client = await connectAssistant(api.baseUrl, host.token);
    });
    When('the assistant renames the draft to "Winter Tapas"', async () => {
      const result = await callTool(client, 'rename_contest', { contest: 'Tapas', name: 'Winter Tapas' });
      expect(result.isError).toBeFalsy();
    });
    Then('the draft\'s name becomes "Winter Tapas"', async () => {
      expect(JSON.stringify(body(await callTool(client, 'get_draft', { contest: 'Winter Tapas' })))).toContain(
        'Winter Tapas',
      );
    });
  });

  Scenario('Publishing a draft must be confirmed', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a complete, publishable draft', async () => {
      const api = await startTrackedApi();
      const host = await hostWithDraft(api.app, api.database, 'ana@example.com');
      client = await connectAssistant(api.baseUrl, host.token);
    });
    When('the assistant is asked to publish the draft without a confirmation', async () => {
      result = await callTool(client, 'publish_contest', { contest: 'Tapas' });
    });
    Then('the draft is not published', async () => {
      // Still a draft — it can still be read as one.
      expect((await callTool(client, 'get_draft', { contest: 'Tapas' })).isError).toBeFalsy();
    });
    And('the assistant is told the action needs confirming', () => {
      expect(body(result)).toMatchObject({ confirmationRequired: true });
    });
  });

  Scenario('A confirmed publish creates a live contest', ({ Given, When, Then }) => {
    let client: Client;
    let confirmationToken: string;
    let result: ToolResult;

    Given('a host with a complete, publishable draft and the confirmation to publish it', async () => {
      const api = await startTrackedApi();
      const host = await hostWithDraft(api.app, api.database, 'ana@example.com');
      client = await connectAssistant(api.baseUrl, host.token);
      confirmationToken = body(await callTool(client, 'publish_contest', { contest: 'Tapas' }))
        .confirmationToken as string;
    });
    When('the assistant publishes the draft with that confirmation', async () => {
      result = await callTool(client, 'publish_contest', { contest: 'Tapas', confirmationToken });
    });
    Then('the contest is live', async () => {
      expect(result.isError).toBeFalsy();
      const contest = body(result);
      // Publishing returns the new contest (id + join code); read it back to confirm it is live.
      expect(contest).toHaveProperty('joinCode');
      const readBack = body(await callTool(client, 'get_contest', { contest: 'Tapas' }));
      expect(readBack).toMatchObject({ status: 'live' });
    });
  });
});
