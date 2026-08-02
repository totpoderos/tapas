import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { afterAll, expect } from 'vitest';
import { buildMcpServer } from '../../src/mcp-server.js';
import { hostWithToken, saveNamedDraftAs, startApi, type RunningApi } from '../support/api-harness.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./managing-participants-through-an-assistant.feature', import.meta.url)),
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

function callTool(client: Client, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  return client.callTool({ name, arguments: args }) as Promise<ToolResult>;
}

function body(result: ToolResult): Record<string, unknown> {
  const [block] = result.content;
  if (!block) throw new Error('tool result had no content');
  return JSON.parse(block.text) as Record<string, unknown>;
}

/** The current participant names of a draft, read back through the assistant by name. */
async function participantsOf(client: Client, contest: string): Promise<string[]> {
  const details = body(await callTool(client, 'get_contest_details', { name: contest })).details as {
    participants: string[];
  };
  return details.participants;
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

  Scenario('The assistant adds a participant to a draft by name', ({ Given, When, Then }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a personal access token and a draft named "Tapas Night" with Ana and Bob taking part', async () => {
      const api = await startTrackedApi();
      const token = await hostWithToken(api.app, api.db, 'ana@example.com');
      await saveNamedDraftAs(api.app, token, 'Tapas Night', ['Ana', 'Bob']);
      client = await connectAssistant(api.baseUrl, token);
    });
    When('the assistant is asked to add "Carmen" to "Tapas Night" with the host\'s token', async () => {
      result = await callTool(client, 'add_participant', { contest: 'Tapas Night', participant: 'Carmen' });
    });
    Then('Ana, Bob and Carmen are taking part in the draft', () => {
      expect(result.isError).toBeFalsy();
      expect((body(result).details as { participants: string[] }).participants).toEqual(['Ana', 'Bob', 'Carmen']);
    });
  });

  Scenario('Removing a participant is not carried out until the host confirms', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a personal access token and a draft named "Tapas Night" with Ana and Bob taking part', async () => {
      const api = await startTrackedApi();
      const token = await hostWithToken(api.app, api.db, 'ana@example.com');
      await saveNamedDraftAs(api.app, token, 'Tapas Night', ['Ana', 'Bob']);
      client = await connectAssistant(api.baseUrl, token);
    });
    When('the assistant is asked to remove "Bob" from "Tapas Night" without a confirmation', async () => {
      result = await callTool(client, 'remove_participant', { contest: 'Tapas Night', participant: 'Bob' });
    });
    Then('the assistant asks the host to confirm first', () => {
      expect(body(result)).toMatchObject({ confirmationRequired: true });
    });
    And('Bob is still taking part in the draft', async () => {
      expect(await participantsOf(client, 'Tapas Night')).toContain('Bob');
    });
  });

  Scenario('The assistant removes a participant once the host confirms', ({ Given, When, Then }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a personal access token and a draft named "Tapas Night" with Ana and Bob taking part', async () => {
      const api = await startTrackedApi();
      const token = await hostWithToken(api.app, api.db, 'ana@example.com');
      await saveNamedDraftAs(api.app, token, 'Tapas Night', ['Ana', 'Bob']);
      client = await connectAssistant(api.baseUrl, token);
    });
    When('the assistant is asked to remove "Bob" from "Tapas Night" with a valid confirmation', async () => {
      const challenge = body(await callTool(client, 'remove_participant', { contest: 'Tapas Night', participant: 'Bob' }));
      result = await callTool(client, 'remove_participant', {
        contest: 'Tapas Night',
        participant: 'Bob',
        confirmationToken: challenge.confirmationToken,
      });
    });
    Then('only Ana is taking part in the draft', () => {
      expect(result.isError).toBeFalsy();
      expect((body(result).details as { participants: string[] }).participants).toEqual(['Ana']);
    });
  });

  Scenario('Removing somebody who is not taking part is refused', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given('a host with a personal access token and a draft named "Tapas Night" with Ana and Bob taking part', async () => {
      const api = await startTrackedApi();
      const token = await hostWithToken(api.app, api.db, 'ana@example.com');
      await saveNamedDraftAs(api.app, token, 'Tapas Night', ['Ana', 'Bob']);
      client = await connectAssistant(api.baseUrl, token);
    });
    When('the assistant is asked to remove "Zoe" from "Tapas Night" with a valid confirmation', async () => {
      const args = { contest: 'Tapas Night', participant: 'Zoe' };
      const challenge = body(await callTool(client, 'remove_participant', args));
      result = await callTool(client, 'remove_participant', {
        ...args,
        confirmationToken: challenge.confirmationToken,
      });
    });
    Then('the request is refused because nobody by that name is taking part', () => {
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toMatch(/nobody called "Zoe" is taking part/i);
    });
    And('Ana and Bob are both still taking part in the draft', async () => {
      expect(await participantsOf(client, 'Tapas Night')).toEqual(['Ana', 'Bob']);
    });
  });

  Scenario('Removing a name two people share is put back to the host', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" with two people called "Ana", and Bob taking part',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await saveNamedDraftAs(api.app, token, 'Tapas Night', ['Ana', 'Ana', 'Bob']);
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When('the assistant is asked to remove "Ana" from "Tapas Night" with a valid confirmation', async () => {
      const args = { contest: 'Tapas Night', participant: 'Ana' };
      const challenge = body(await callTool(client, 'remove_participant', args));
      result = await callTool(client, 'remove_participant', {
        ...args,
        confirmationToken: challenge.confirmationToken,
      });
    });
    Then('the request is refused because more than one person has that name', () => {
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toMatch(/more than one person/i);
    });
    /* This used to remove BOTH of them, on a confirmation that named one. */
    And('both people called "Ana" are still taking part in the draft', async () => {
      expect(await participantsOf(client, 'Tapas Night')).toEqual(['Ana', 'Ana', 'Bob']);
    });
  });

  Scenario('Without a valid token the assistant cannot add a participant', ({ When, Then }) => {
    let result: ToolResult;

    When('the assistant is asked to add a participant without a valid personal access token', async () => {
      const api = await startTrackedApi();
      const client = await connectAssistant(api.baseUrl, 'not-a-real-token');
      result = await callTool(client, 'add_participant', { contest: 'Tapas Night', participant: 'Carmen' });
    });
    Then('the request is refused as not authorized', () => {
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text ?? '').toMatch(/not authorized/i);
    });
  });
});
