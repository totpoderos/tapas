import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { afterAll, expect } from 'vitest';
import { buildMcpServer } from '../../src/mcp-server.js';
import { hostWithPublishedContest, hostWithToken, startApi, type RunningApi } from '../support/api-harness.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./reading-a-contest-through-an-assistant.feature', import.meta.url)),
);

interface ToolResult {
  readonly isError?: boolean;
  readonly content: readonly { readonly type: string; readonly text: string }[];
}

/** Connects an MCP client to a server bound to one host's token, over an in-memory transport. */
async function connectAssistant(apiBaseUrl: string, hostToken: string): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = buildMcpServer({ apiBaseUrl, hostToken });
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-assistant', version: '0.0.0' });
  await client.connect(clientTransport);
  return client;
}

async function readContest(client: Client, contestId: string): Promise<ToolResult> {
  return (await client.callTool({ name: 'get_contest', arguments: { contestId } })) as ToolResult;
}

/** The text of the result's first content block, which every get_contest result carries. */
function firstText(result: ToolResult): string {
  const [block] = result.content;
  if (!block) throw new Error('tool result had no content');
  return block.text;
}

describeFeature(feature, ({ Scenario }) => {
  // vitest-cucumber runs each Given/When/Then as its own test, so a per-step
  // afterEach would tear the API down mid-scenario. Track every API started and
  // close them all once the feature is done.
  const started: RunningApi[] = [];
  const startTrackedApi = async (): Promise<RunningApi> => {
    const running = await startApi();
    started.push(running);
    return running;
  };
  afterAll(async () => {
    for (const running of started) await running.close();
  });

  Scenario('The assistant reads a contest the host owns', ({ Given, When, Then }) => {
    let client: Client;
    let contestId: string;
    let result: ToolResult;

    Given('a host with a personal access token and a contest they own', async () => {
      const api = await startTrackedApi();
      const host = await hostWithPublishedContest(api.app, 'ana@example.com');
      contestId = host.contestId;
      client = await connectAssistant(api.baseUrl, host.token);
    });
    When("the assistant is asked to read that contest with the host's token", async () => {
      result = await readContest(client, contestId);
    });
    Then('the contest is returned', () => {
      expect(result.isError).toBeFalsy();
      expect(JSON.parse(firstText(result))).toMatchObject({ id: contestId });
    });
  });

  Scenario('The assistant cannot read a contest the host does not own', ({ Given, When, Then }) => {
    let client: Client;
    let othersContestId: string;
    let result: ToolResult;

    Given('a host with a personal access token, and a contest owned by a different host', async () => {
      const api = await startTrackedApi();
      const other = await hostWithPublishedContest(api.app, 'other@example.com');
      othersContestId = other.contestId;
      const intruderToken = await hostWithToken(api.app, 'ana@example.com');
      client = await connectAssistant(api.baseUrl, intruderToken);
    });
    When("the assistant is asked to read the other host's contest with the first host's token", async () => {
      result = await readContest(client, othersContestId);
    });
    Then('the request is refused as not allowed', () => {
      expect(result.isError).toBe(true);
      expect(firstText(result)).toMatch(/not allowed/i);
    });
  });

  Scenario('Without a valid token the assistant cannot read a contest', ({ Given, When, Then }) => {
    let client: Client;
    let contestId: string;
    let result: ToolResult;

    Given('a contest and no valid personal access token', async () => {
      const api = await startTrackedApi();
      const host = await hostWithPublishedContest(api.app, 'ana@example.com');
      contestId = host.contestId;
      client = await connectAssistant(api.baseUrl, 'not-a-real-token');
    });
    When('the assistant is asked to read the contest without a valid token', async () => {
      result = await readContest(client, contestId);
    });
    Then('the request is refused as not authorized', () => {
      expect(result.isError).toBe(true);
      expect(firstText(result)).toMatch(/not authorized/i);
    });
  });
});
