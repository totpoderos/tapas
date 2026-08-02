import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { afterAll, expect } from 'vitest';
import { buildMcpServer } from '../../src/mcp-server.js';
import {
  hostWithClosedContest,
  hostWithRevealedContest,
  startApi,
  type RunningApi,
} from '../support/api-harness.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./revealing-results-through-an-assistant.feature', import.meta.url)),
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

async function contestStatus(client: Client, contest: string): Promise<string> {
  return body(await callTool(client, 'get_contest', { contest })).status as string;
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

  Scenario('Revealing a contest must be confirmed', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a closed contest ready to reveal', async () => {
      const api = await startTrackedApi();
      const host = await hostWithClosedContest(api.app, api.db, 'ana@example.com');
      client = await connectAssistant(api.baseUrl, host.token);
    });
    When('the assistant is asked to reveal it without a confirmation', async () => {
      result = await callTool(client, 'trigger_reveal', { contest: 'Tapas' });
    });
    Then('the contest is not revealed', async () => {
      expect(await contestStatus(client, 'Tapas')).toBe('closed');
    });
    And('the assistant is told the action needs confirming', () => {
      expect(body(result)).toMatchObject({ confirmationRequired: true });
    });
  });

  Scenario('A confirmed reveal reveals the contest', ({ Given, When, Then }) => {
    let client: Client;
    let confirmationToken: string;
    let result: ToolResult;

    Given('a host with a closed contest and the confirmation to reveal it', async () => {
      const api = await startTrackedApi();
      const host = await hostWithClosedContest(api.app, api.db, 'ana@example.com');
      client = await connectAssistant(api.baseUrl, host.token);
      confirmationToken = body(await callTool(client, 'trigger_reveal', { contest: 'Tapas' }))
        .confirmationToken as string;
    });
    When('the assistant reveals the contest with that confirmation', async () => {
      result = await callTool(client, 'trigger_reveal', { contest: 'Tapas', confirmationToken });
    });
    Then('the contest is revealed', () => {
      expect(result.isError).toBeFalsy();
      expect(body(result)).toMatchObject({ status: 'revealed' });
    });
  });

  Scenario('The assistant reads the results of a revealed contest', ({ Given, When, Then }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a revealed contest', async () => {
      const api = await startTrackedApi();
      const host = await hostWithRevealedContest(api.app, api.db, 'ana@example.com');
      client = await connectAssistant(api.baseUrl, host.token);
    });
    When('the assistant is asked to read its results', async () => {
      result = await callTool(client, 'get_results', { contest: 'Tapas' });
    });
    Then('the results are returned', () => {
      expect(result.isError).toBeFalsy();
      expect(body(result)).toHaveProperty('categories');
    });
  });
});
