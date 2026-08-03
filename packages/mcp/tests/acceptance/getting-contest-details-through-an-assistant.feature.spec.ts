import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { afterAll, expect } from 'vitest';
import { buildMcpServer } from '../../src/mcp-server.js';
import {
  hostWithNamedContest,
  hostWithToken,
  publishNamedContestAs,
  startApi,
  type RunningApi,
} from '../support/api-harness.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./getting-contest-details-through-an-assistant.feature', import.meta.url)),
);

interface ToolResult {
  readonly isError?: boolean;
  readonly content: readonly { readonly type: string; readonly text: string }[];
}

async function connectAssistant(apiBaseUrl: string, hostToken: string): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = buildMcpServer({ apiBaseUrl, hostToken, confirmationSecret: 'test-confirmation-secret' });
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-assistant', version: '0.0.0' });
  await client.connect(clientTransport);
  return client;
}

function getDetails(client: Client, name: string): Promise<ToolResult> {
  return client.callTool({ name: 'get_contest_details', arguments: { name } }) as Promise<ToolResult>;
}

function firstText(result: ToolResult): string {
  const [block] = result.content;
  if (!block) throw new Error('tool result had no content');
  return block.text;
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

  Scenario("The assistant reads a contest's details by name", ({ Given, When, Then }) => {
    let client: Client;
    let result: ToolResult;

    // The harness's contest is seeded with participants Ana, Bob, Carol.
    Given('a host with a personal access token and a contest named "Tapas Night" with Ana and Bob taking part', async () => {
      const api = await startTrackedApi();
      const host = await hostWithNamedContest(api.app, api.database, 'ana@example.com', 'Tapas Night');
      client = await connectAssistant(api.baseUrl, host.token);
    });
    When('the assistant is asked for the details of "Tapas Night" with the host\'s token', async () => {
      result = await getDetails(client, 'Tapas Night');
    });
    Then('the details name Ana and Bob as taking part', () => {
      expect(result.isError).toBeFalsy();
      const { details } = JSON.parse(firstText(result));
      expect(details.participants).toEqual(expect.arrayContaining(['Ana', 'Bob']));
    });
  });

  Scenario('The assistant is offered the choice when several share a name', ({ Given, When, Then }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a personal access token and two contests both named "Tapas Night"', async () => {
      const api = await startTrackedApi();
      const token = await hostWithToken(api.app, api.database, 'ana@example.com');
      await publishNamedContestAs(api.app, token, 'Tapas Night');
      await publishNamedContestAs(api.app, token, 'Tapas Night');
      client = await connectAssistant(api.baseUrl, token);
    });
    When('the assistant is asked for the details of "Tapas Night" with the host\'s token', async () => {
      result = await getDetails(client, 'Tapas Night');
    });
    Then('both contests are offered to choose from', () => {
      const body = JSON.parse(firstText(result));
      expect(body.details).toBeUndefined();
      expect(body.candidates).toHaveLength(2);
    });
  });

  Scenario("The assistant reads only the host's own contest details", ({ Given, When, Then }) => {
    let client: Client;
    let result: ToolResult;

    Given(
      'a host with a personal access token, and a contest named "Tapas Night" owned by a different host',
      async () => {
        const api = await startTrackedApi();
        await hostWithNamedContest(api.app, api.database, 'other@example.com', 'Tapas Night');
        const anaToken = await hostWithToken(api.app, api.database, 'ana@example.com');
        client = await connectAssistant(api.baseUrl, anaToken);
      },
    );
    When('the assistant is asked for the details of "Tapas Night" with the host\'s token', async () => {
      result = await getDetails(client, 'Tapas Night');
    });
    Then('no contest is found', () => {
      expect(result.isError).toBeFalsy();
      expect(JSON.parse(firstText(result)).candidates).toEqual([]);
    });
  });

  Scenario('Without a valid token the assistant cannot read contest details', ({ When, Then }) => {
    let result: ToolResult;

    When('the assistant is asked for a contest\'s details without a valid personal access token', async () => {
      const api = await startTrackedApi();
      const client = await connectAssistant(api.baseUrl, 'not-a-real-token');
      result = await getDetails(client, 'Tapas Night');
    });
    Then('the request is refused as not authorized', () => {
      expect(result.isError).toBe(true);
      expect(firstText(result)).toMatch(/not authorized/i);
    });
  });
});
