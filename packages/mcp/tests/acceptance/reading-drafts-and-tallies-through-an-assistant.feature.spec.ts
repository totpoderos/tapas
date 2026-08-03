import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { afterAll, expect } from 'vitest';
import { buildMcpServer } from '../../src/mcp-server.js';
import {
  hostWithDraft,
  hostWithPublishedContest,
  hostWithToken,
  startApi,
  type RunningApi,
} from '../support/api-harness.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./reading-drafts-and-tallies-through-an-assistant.feature', import.meta.url)),
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

async function callTool(client: Client, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  return (await client.callTool({ name, arguments: args })) as ToolResult;
}

/** The text of the result's first content block, which every tool result carries. */
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

  Scenario('The assistant reads a draft the host owns', ({ Given, When, Then }) => {
    let client: Client;
    let draftId: string;
    let result: ToolResult;

    Given('a host with a personal access token and a saved draft', async () => {
      const api = await startTrackedApi();
      const host = await hostWithDraft(api.app, api.database, 'ana@example.com');
      draftId = host.draftId;
      client = await connectAssistant(api.baseUrl, host.token);
    });
    When("the assistant is asked to read that draft by name with the host's token", async () => {
      result = await callTool(client, 'get_draft', { contest: 'Tapas' });
    });
    Then('the draft is returned', () => {
      expect(result.isError).toBeFalsy();
      expect(JSON.parse(firstText(result))).toMatchObject({ id: draftId });
    });
  });

  Scenario("The assistant reads the live tally of the host's contest", ({ Given, When, Then }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a personal access token and a running contest', async () => {
      const api = await startTrackedApi();
      const host = await hostWithPublishedContest(api.app, api.database, 'ana@example.com');
      client = await connectAssistant(api.baseUrl, host.token);
    });
    When("the assistant is asked to read that contest's tally by name with the host's token", async () => {
      result = await callTool(client, 'get_tally', { contest: 'Tapas' });
    });
    Then('the tally is returned', () => {
      expect(result.isError).toBeFalsy();
      // A freshly published contest with no activity: everyone still to claim.
      expect(JSON.parse(firstText(result))).toMatchObject({ sentCount: 0 });
    });
  });

  Scenario('The assistant cannot read a draft the host does not own', ({ Given, When, Then }) => {
    let client: Client;
    let othersDraftId: string;
    let result: ToolResult;

    Given('a host with a personal access token, and a draft owned by a different host', async () => {
      const api = await startTrackedApi();
      const other = await hostWithDraft(api.app, api.database, 'other@example.com');
      othersDraftId = other.draftId;
      expect(othersDraftId).toBeTruthy();
      const intruderToken = await hostWithToken(api.app, api.database, 'ana@example.com');
      client = await connectAssistant(api.baseUrl, intruderToken);
    });
    When("the assistant is asked to read the other host's draft by name with the first host's token", async () => {
      result = await callTool(client, 'get_draft', { contest: 'Tapas' });
    });
    /*
     * Not "refused as not allowed", which is what this asserted while drafts were
     * addressed by id. Only the host's own contests are searched by name, so the
     * other host's draft is not refused — it is not there. A refusal would have
     * confirmed that a draft by that name exists, which is the one thing a
     * different host must not be able to learn from asking.
     */
    Then('no draft is found', () => {
      expect(result.isError).toBeFalsy();
      expect(JSON.parse(firstText(result))).toEqual({ candidates: [] });
    });
  });
});
