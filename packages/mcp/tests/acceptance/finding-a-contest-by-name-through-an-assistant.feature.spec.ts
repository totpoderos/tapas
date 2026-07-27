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
  fileURLToPath(new URL('./finding-a-contest-by-name-through-an-assistant.feature', import.meta.url)),
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

function findContest(client: Client, name: string): Promise<ToolResult> {
  return client.callTool({ name: 'find_contest', arguments: { name } }) as Promise<ToolResult>;
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

  Scenario('The assistant finds a contest by name', ({ Given, When, Then }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a personal access token and a contest named "Tapas Night"', async () => {
      const api = await startTrackedApi();
      const host = await hostWithNamedContest(api.app, 'ana@example.com', 'Tapas Night');
      client = await connectAssistant(api.baseUrl, host.token);
    });
    When('the assistant is asked to find the contest named "Tapas Night" with the host\'s token', async () => {
      result = await findContest(client, 'Tapas Night');
    });
    Then('the contest named "Tapas Night" is found', () => {
      expect(result.isError).toBeFalsy();
      const found = JSON.parse(firstText(result));
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('Tapas Night');
    });
  });

  Scenario('When several contests share a name, the assistant is given all of them', ({ Given, When, Then }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a personal access token and two contests both named "Tapas Night"', async () => {
      const api = await startTrackedApi();
      const token = await hostWithToken(api.app, 'ana@example.com');
      await publishNamedContestAs(api.app, token, 'Tapas Night');
      await publishNamedContestAs(api.app, token, 'Tapas Night');
      client = await connectAssistant(api.baseUrl, token);
    });
    When('the assistant is asked to find the contest named "Tapas Night" with the host\'s token', async () => {
      result = await findContest(client, 'Tapas Night');
    });
    Then('both contests named "Tapas Night" are offered', () => {
      expect(result.isError).toBeFalsy();
      const found = JSON.parse(firstText(result));
      expect(found).toHaveLength(2);
      expect(found.every((c: { name: string }) => c.name === 'Tapas Night')).toBe(true);
    });
  });

  Scenario("The assistant finds only the host's own contests by name", ({ Given, When, Then }) => {
    let client: Client;
    let result: ToolResult;

    Given(
      'a host with a personal access token, and a contest named "Tapas Night" owned by a different host',
      async () => {
        const api = await startTrackedApi();
        await hostWithNamedContest(api.app, 'other@example.com', 'Tapas Night');
        const anaToken = await hostWithToken(api.app, 'ana@example.com');
        client = await connectAssistant(api.baseUrl, anaToken);
      },
    );
    When('the assistant is asked to find the contest named "Tapas Night" with the host\'s token', async () => {
      result = await findContest(client, 'Tapas Night');
    });
    Then('no contest is found', () => {
      expect(result.isError).toBeFalsy();
      expect(JSON.parse(firstText(result))).toEqual([]);
    });
  });

  Scenario('Without a valid token the assistant cannot find a contest by name', ({ When, Then }) => {
    let result: ToolResult;

    When('the assistant is asked to find a contest by name without a valid personal access token', async () => {
      const api = await startTrackedApi();
      const client = await connectAssistant(api.baseUrl, 'not-a-real-token');
      result = await findContest(client, 'Tapas Night');
    });
    Then('the request is refused as not authorized', () => {
      expect(result.isError).toBe(true);
      expect(firstText(result)).toMatch(/not authorized/i);
    });
  });
});
