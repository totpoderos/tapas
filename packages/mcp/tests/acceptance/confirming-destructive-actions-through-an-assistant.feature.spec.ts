import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { afterAll, expect } from 'vitest';
import { buildMcpServer } from '../../src/mcp-server.js';
import {
  hostWithToken,
  publishContestAs,
  publishNamedContestAs,
  startApi,
  type RunningApi,
} from '../support/api-harness.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./confirming-destructive-actions-through-an-assistant.feature', import.meta.url)),
);

const SECRET = 'test-confirmation-secret';

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

  Scenario('A destructive action is not carried out until it is confirmed', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a personal access token and a running contest', async () => {
      const api = await startTrackedApi();
      const token = await hostWithToken(api.app, api.database, 'ana@example.com');
      await publishContestAs(api.app, token);
      client = await connectAssistant(api.baseUrl, token);
    });
    When('the assistant is asked to close the contest without a confirmation', async () => {
      result = await callTool(client, 'close_contest', { contest: 'Tapas' });
    });
    Then('the contest is not closed', async () => {
      expect(await contestStatus(client, 'Tapas')).toBe('live');
    });
    And('the assistant is told the action needs confirming', () => {
      expect(body(result)).toMatchObject({ confirmationRequired: true });
    });
  });

  Scenario('A confirmed destructive action is carried out', ({ Given, When, Then }) => {
    let client: Client;
    let confirmationToken: string;
    let result: ToolResult;

    Given('a host who has been told how to confirm closing their running contest', async () => {
      const api = await startTrackedApi();
      const token = await hostWithToken(api.app, api.database, 'ana@example.com');
      await publishContestAs(api.app, token);
      client = await connectAssistant(api.baseUrl, token);
      // The first, unconfirmed call hands back the confirmation to send.
      const challenge = body(await callTool(client, 'close_contest', { contest: 'Tapas' }));
      confirmationToken = challenge.confirmationToken as string;
    });
    When('the assistant closes the contest with that confirmation', async () => {
      result = await callTool(client, 'close_contest', { contest: 'Tapas', confirmationToken });
    });
    Then('the contest is closed', () => {
      expect(result.isError).toBeFalsy();
      expect(body(result)).toMatchObject({ status: 'closed' });
    });
  });

  Scenario('A confirmation for one action does not authorize another', ({ Given, When, Then, And }) => {
    let client: Client;
    let firstsToken: string;
    let result: ToolResult;

    Given('a host with two running contests and a confirmation to close the first', async () => {
      const api = await startTrackedApi();
      const token = await hostWithToken(api.app, api.database, 'ana@example.com');
      /*
       * Two contests, deliberately named apart. Addressed by name they must be:
       * two contests both called "Tapas" is a different scenario entirely — the
       * host would be asked which they meant and nothing would be confirmed at
       * all, which is not what this scenario is about.
       */
      await publishNamedContestAs(api.app, token, 'Tapas Night');
      await publishNamedContestAs(api.app, token, 'Sunday Roast');
      client = await connectAssistant(api.baseUrl, token);
      firstsToken = body(await callTool(client, 'close_contest', { contest: 'Tapas Night' }))
        .confirmationToken as string;
    });
    When("the assistant tries to close the second contest with the first's confirmation", async () => {
      result = await callTool(client, 'close_contest', {
        contest: 'Sunday Roast',
        confirmationToken: firstsToken,
      });
    });
    Then('the second contest is not closed', async () => {
      expect(await contestStatus(client, 'Sunday Roast')).toBe('live');
    });
    And('the assistant is told the action needs confirming', () => {
      expect(body(result)).toMatchObject({ confirmationRequired: true });
    });
  });
});
