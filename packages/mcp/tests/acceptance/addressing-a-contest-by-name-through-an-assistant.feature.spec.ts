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

/**
 * Implements addressing-a-contest-by-name-through-an-assistant.feature against a
 * real API and a real MCP server. Closing stands for "a change" and reading for
 * "a read": the rule under test belongs to the whole surface, so proving it on
 * one of each is the point rather than repeating it per tool.
 */
const feature = await loadFeature(
  fileURLToPath(new URL('./addressing-a-contest-by-name-through-an-assistant.feature', import.meta.url)),
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

function callTool(client: Client, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  return client.callTool({ name, arguments: args }) as Promise<ToolResult>;
}

function body(result: ToolResult): Record<string, unknown> {
  const [block] = result.content;
  if (!block) throw new Error('tool result had no content');
  return JSON.parse(block.text) as Record<string, unknown>;
}

/**
 * Closes by name, seeing the confirmation through. Destructive tools answer the
 * first call with a token and act only on the second — unchanged by this slice,
 * so the steps carry it rather than testing it again here.
 */
async function closeConfirming(client: Client, contest: string): Promise<ToolResult> {
  const challenge = body(await callTool(client, 'close_contest', { contest }));
  const confirmationToken = challenge.confirmationToken as string | undefined;
  if (confirmationToken === undefined) return { content: [{ type: 'text', text: JSON.stringify(challenge) }] };
  return callTool(client, 'close_contest', { contest, confirmationToken });
}

async function statusOf(client: Client, contest: string): Promise<unknown> {
  return body(await callTool(client, 'get_contest', { contest })).status;
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

  Scenario('An action names the contest it acts on', ({ Given, When, Then }) => {
    let client: Client;

    Given('a host with a personal access token and a running contest named "Tapas Night"', async () => {
      const api = await startTrackedApi();
      const host = await hostWithNamedContest(api.app, api.database, 'ana@example.com', 'Tapas Night');
      client = await connectAssistant(api.baseUrl, host.token);
    });
    When('the assistant is asked to close "Tapas Night" with the host\'s token, confirming', async () => {
      await closeConfirming(client, 'Tapas Night');
    });
    Then('the contest named "Tapas Night" is closed', async () => {
      expect(await statusOf(client, 'Tapas Night')).toBe('closed');
    });
  });

  Scenario('A read names the contest it reads', ({ Given, When, Then }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a personal access token and a running contest named "Tapas Night"', async () => {
      const api = await startTrackedApi();
      const host = await hostWithNamedContest(api.app, api.database, 'ana@example.com', 'Tapas Night');
      client = await connectAssistant(api.baseUrl, host.token);
    });
    When('the assistant is asked to read "Tapas Night" with the host\'s token', async () => {
      result = await callTool(client, 'get_contest', { contest: 'Tapas Night' });
    });
    Then('the contest named "Tapas Night" is returned', () => {
      expect(result.isError).toBeFalsy();
      expect(body(result)).toMatchObject({ name: 'Tapas Night', status: 'live' });
    });
  });

  Scenario('A name several contests share changes nothing and offers the choice', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given(
      'a host with a personal access token and two running contests both named "Tapas Night"',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.database, 'ana@example.com');
        await publishNamedContestAs(api.app, token, 'Tapas Night');
        await publishNamedContestAs(api.app, token, 'Tapas Night');
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When('the assistant is asked to close "Tapas Night" with the host\'s token, confirming', async () => {
      result = await closeConfirming(client, 'Tapas Night');
    });
    Then('both contests are offered to choose from', () => {
      const candidates = body(result).candidates as readonly { name: string }[];
      expect(candidates).toHaveLength(2);
      expect(candidates.every((c) => c.name === 'Tapas Night')).toBe(true);
    });
    And('neither contest is closed', () => {
      const candidates = body(result).candidates as readonly { status: string }[];
      expect(candidates.every((c) => c.status === 'live')).toBe(true);
    });
  });

  Scenario('A name no contest has changes nothing', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a personal access token and a running contest named "Tapas Night"', async () => {
      const api = await startTrackedApi();
      const host = await hostWithNamedContest(api.app, api.database, 'ana@example.com', 'Tapas Night');
      client = await connectAssistant(api.baseUrl, host.token);
    });
    When('the assistant is asked to close "Sunday Roast" with the host\'s token, confirming', async () => {
      result = await closeConfirming(client, 'Sunday Roast');
    });
    Then('no contest is found', () => {
      expect(result.isError).toBeFalsy();
      expect(body(result)).toEqual({ candidates: [] });
    });
    And('the contest named "Tapas Night" is still running', async () => {
      expect(await statusOf(client, 'Tapas Night')).toBe('live');
    });
  });

  Scenario('A name matches without regard to case', ({ Given, When, Then }) => {
    let client: Client;

    Given('a host with a personal access token and a running contest named "Tapas Night"', async () => {
      const api = await startTrackedApi();
      const host = await hostWithNamedContest(api.app, api.database, 'ana@example.com', 'Tapas Night');
      client = await connectAssistant(api.baseUrl, host.token);
    });
    When('the assistant is asked to close "tapas night" with the host\'s token, confirming', async () => {
      await closeConfirming(client, 'tapas night');
    });
    Then('the contest named "Tapas Night" is closed', async () => {
      expect(await statusOf(client, 'Tapas Night')).toBe('closed');
    });
  });

  Scenario("Another host's contest is never reached by name", ({ Given, When, Then, And }) => {
    let client: Client;
    let otherClient: Client;
    let result: ToolResult;

    Given(
      'a host with a personal access token, and a running contest named "Tapas Night" owned by a different host',
      async () => {
        const api = await startTrackedApi();
        const other = await hostWithNamedContest(api.app, api.database, 'other@example.com', 'Tapas Night');
        otherClient = await connectAssistant(api.baseUrl, other.token);
        const intruderToken = await hostWithToken(api.app, api.database, 'ana@example.com');
        client = await connectAssistant(api.baseUrl, intruderToken);
      },
    );
    When('the assistant is asked to close "Tapas Night" with the host\'s token, confirming', async () => {
      result = await closeConfirming(client, 'Tapas Night');
    });
    /*
     * Not "refused as not allowed". Only the host's own contests are searched, so
     * the other host's is not there — and a refusal would confirm to a stranger
     * that a contest by that name exists.
     */
    Then('no contest is found', () => {
      expect(result.isError).toBeFalsy();
      expect(body(result)).toEqual({ candidates: [] });
    });
    And("the other host's contest is still running", async () => {
      expect(await statusOf(otherClient, 'Tapas Night')).toBe('live');
    });
  });

  Scenario('A shared name is settled before the host is asked to confirm anything', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given(
      'a host with a personal access token and two running contests both named "Tapas Night"',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.database, 'ana@example.com');
        await publishNamedContestAs(api.app, token, 'Tapas Night');
        await publishNamedContestAs(api.app, token, 'Tapas Night');
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When('the assistant is asked to close "Tapas Night" with the host\'s token, without confirming', async () => {
      result = await callTool(client, 'close_contest', { contest: 'Tapas Night' });
    });
    Then('both contests are offered to choose from', () => {
      expect(body(result).candidates).toHaveLength(2);
    });
    /*
     * The point of settling first. Being handed a confirmation for "close Tapas
     * Night" while holding two of them is a question nobody can answer — the
     * host would be approving something that is not yet one thing.
     */
    And('the assistant is not asked to confirm anything', () => {
      expect(body(result).confirmationRequired).toBeUndefined();
      expect(body(result).confirmationToken).toBeUndefined();
    });
    And('neither contest is closed', async () => {
      const listed = await callTool(client, 'find_contest', { name: 'Tapas Night' });
      const contests = JSON.parse(listed.content[0]!.text) as readonly { status: string }[];
      expect(contests.every((c) => c.status === 'live')).toBe(true);
    });
  });

  Scenario('A name no contest has is settled before the host is asked to confirm anything', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a personal access token and a running contest named "Tapas Night"', async () => {
      const api = await startTrackedApi();
      const host = await hostWithNamedContest(api.app, api.database, 'ana@example.com', 'Tapas Night');
      client = await connectAssistant(api.baseUrl, host.token);
    });
    When('the assistant is asked to close "Sunday Roast" with the host\'s token, without confirming', async () => {
      result = await callTool(client, 'close_contest', { contest: 'Sunday Roast' });
    });
    Then('no contest is found', () => {
      expect(body(result)).toEqual({ candidates: [] });
    });
    And('the assistant is not asked to confirm anything', () => {
      expect(body(result).confirmationRequired).toBeUndefined();
    });
  });
});
