import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { afterAll, expect } from 'vitest';
import { buildMcpServer } from '../../src/mcp-server.js';
import {
  hostWithPublishedContest,
  hostWithToken,
  publishContestAs,
  startApi,
  type RunningApi,
} from '../support/api-harness.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./listing-contests-through-an-assistant.feature', import.meta.url)),
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

function listContests(client: Client): Promise<ToolResult> {
  return client.callTool({ name: 'list_my_contests', arguments: {} }) as Promise<ToolResult>;
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

  Scenario("The assistant lists the host's contests", ({ Given, When, Then }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a personal access token and two contests they own', async () => {
      const api = await startTrackedApi();
      const token = await hostWithToken(api.app, api.database, 'ana@example.com');
      await publishContestAs(api.app, token);
      await publishContestAs(api.app, token);
      client = await connectAssistant(api.baseUrl, token);
    });
    When("the assistant is asked to list the host's contests with the host's token", async () => {
      result = await listContests(client);
    });
    Then("both of the host's contests are listed", () => {
      expect(result.isError).toBeFalsy();
      expect(JSON.parse(firstText(result))).toHaveLength(2);
    });
  });

  Scenario('The assistant is told how each contest is going', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a personal access token and a published contest they own', async () => {
      const api = await startTrackedApi();
      const token = await hostWithToken(api.app, api.database, 'ana@example.com');
      await publishContestAs(api.app, token);
      client = await connectAssistant(api.baseUrl, token);
    });
    When("the assistant is asked to list the host's contests with the host's token", async () => {
      result = await listContests(client);
    });
    Then('that contest is listed with its join code and its progress', () => {
      expect(result.isError).toBeFalsy();
      const [listed] = JSON.parse(firstText(result)) as {
        joinCode?: string;
        progress?: { claimedCount: number; draftCount: number; sentCount: number };
        format?: string;
        categoryCount?: number;
      }[];
      expect(listed?.joinCode).toMatch(/\S/);
      // Published with a roster nobody has claimed: real zeroes, not absence.
      expect(listed?.progress).toEqual({ claimedCount: 0, draftCount: 0, sentCount: 0 });
    });
    And('it is listed with what it is judged on', () => {
      const [listed] = JSON.parse(firstText(result)) as {
        format?: string;
        categoryCount?: number;
      }[];
      expect(listed?.format).toBe('solo');
      expect(listed?.categoryCount).toBe(1);
    });
  });

  Scenario("The assistant lists only the host's own contests", ({ Given, When, Then }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a personal access token, and a contest owned by a different host', async () => {
      const api = await startTrackedApi();
      await hostWithPublishedContest(api.app, api.database, 'other@example.com');
      const anaToken = await hostWithToken(api.app, api.database, 'ana@example.com');
      client = await connectAssistant(api.baseUrl, anaToken);
    });
    When("the assistant is asked to list the host's contests with the host's token", async () => {
      result = await listContests(client);
    });
    Then("the other host's contest is not listed", () => {
      expect(result.isError).toBeFalsy();
      expect(JSON.parse(firstText(result))).toEqual([]);
    });
  });

  Scenario('Without a valid token the assistant cannot list contests', ({ When, Then }) => {
    let result: ToolResult;

    When('the assistant is asked to list contests without a valid personal access token', async () => {
      const api = await startTrackedApi();
      const client = await connectAssistant(api.baseUrl, 'not-a-real-token');
      result = await listContests(client);
    });
    Then('the request is refused as not authorized', () => {
      expect(result.isError).toBe(true);
      expect(firstText(result)).toMatch(/not authorized/i);
    });
  });
});
