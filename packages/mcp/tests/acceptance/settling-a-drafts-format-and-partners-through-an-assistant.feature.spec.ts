import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { afterAll, expect } from 'vitest';
import { buildMcpServer } from '../../src/mcp-server.js';
import {
  asBearer,
  hostWithToken,
  publishNamedContestAs,
  startApi,
  type RunningApi,
} from '../support/api-harness.js';

const feature = await loadFeature(
  fileURLToPath(
    new URL('./settling-a-drafts-format-and-partners-through-an-assistant.feature', import.meta.url),
  ),
);

interface ToolResult {
  readonly isError?: boolean;
  readonly content: readonly { readonly type: string; readonly text: string }[];
}

interface Pairing {
  readonly id: string;
  readonly displayName: string;
  readonly partnerId?: string;
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

function text(result: ToolResult): string {
  const [block] = result.content;
  if (!block) throw new Error('tool result had no content');
  return block.text;
}

function body(result: ToolResult): Record<string, unknown> {
  return JSON.parse(text(result)) as Record<string, unknown>;
}

/**
 * Saves a draft with the given people (and optional pairings, by index), so a
 * scenario can start from a draft that is already partnered.
 */
async function draftWithPeople(
  api: RunningApi,
  token: string,
  name: string,
  people: readonly { readonly displayName: string; readonly partner?: string }[],
  format = 'solo',
): Promise<void> {
  const ids = people.map((_, i) => `p${i}`);
  await asBearer(api.app, token, 'POST', '/drafts', {
    name,
    format,
    scoring: {
      categories: [{ id: 'c0', name: 'Taste' }],
      range: { type: 'fixed', min: 1, max: 5 },
      uniquePerCategory: false,
    },
    participants: people.map((p, i) => {
      const partnerIndex = p.partner === undefined ? -1 : people.findIndex((o) => o.displayName === p.partner);
      return {
        id: ids[i],
        displayName: p.displayName,
        ...(partnerIndex >= 0 ? { partnerId: ids[partnerIndex] } : {}),
      };
    }),
  });
}

/** Who is paired with whom, by display name — the way a host would read it back. */
async function pairings(client: Client, contest: string): Promise<Record<string, string | null>> {
  const draft = body(await callTool(client, 'get_draft', { contest }));
  const content = draft.content as { participants?: readonly Pairing[] };
  const people = content.participants ?? [];
  const nameOf = (id: string) => (people.find((p) => p.id === id))?.displayName ?? id;
  return Object.fromEntries(people.map((p) => [p.displayName, p.partnerId ? nameOf(p.partnerId) : null]));
}

async function formatOf(client: Client, contest: string): Promise<unknown> {
  const draft = body(await callTool(client, 'get_draft', { contest }));
  return (draft.content as { format?: unknown }).format;
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

  Scenario('The assistant says what kind of contest a draft is', ({ Given, When, Then }) => {
    let client: Client;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" where everyone is on their own',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await draftWithPeople(api, token, 'Tapas Night', [
          { displayName: 'Ana' },
          { displayName: 'Bob' },
        ]);
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When(
      'the assistant is asked to make "Tapas Night" a contest where couples cook together',
      async () => {
        await callTool(client, 'set_format', { contest: 'Tapas Night', format: 'couples' });
      },
    );
    Then('"Tapas Night" is a contest where couples cook together', async () => {
      expect(await formatOf(client, 'Tapas Night')).toBe('couples');
    });
  });

  Scenario('The assistant pairs two people', ({ Given, When, Then }) => {
    let client: Client;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" with Ana, Bob, Carmen and Dan taking part',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await draftWithPeople(api, token, 'Tapas Night', [
          { displayName: 'Ana' },
          { displayName: 'Bob' },
          { displayName: 'Carmen' },
          { displayName: 'Dan' },
        ]);
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When('the assistant is asked to pair Ana with Bob in "Tapas Night"', async () => {
      await callTool(client, 'set_partner', { contest: 'Tapas Night', person: 'Ana', partner: 'Bob' });
    });
    Then('Ana and Bob are partners in "Tapas Night"', async () => {
      expect(await pairings(client, 'Tapas Night')).toMatchObject({ Ana: 'Bob', Bob: 'Ana' });
      // And the answer says so, rather than reporting details a host cannot
      // tell apart from the ones they had before they asked.
      const details = body(await callTool(client, 'get_contest_details', { name: 'Tapas Night' }));
      expect((details.details as { pairs?: unknown }).pairs).toEqual([['Ana', 'Bob']]);
    });
  });

  Scenario('Pairing someone who already had a partner frees the one they leave', ({ Given, When, Then, And }) => {
    let client: Client;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" where Ana and Bob are partners, with Carmen and Dan also taking part',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await draftWithPeople(api, token, 'Tapas Night', [
          { displayName: 'Ana', partner: 'Bob' },
          { displayName: 'Bob', partner: 'Ana' },
          { displayName: 'Carmen' },
          { displayName: 'Dan' },
        ]);
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When('the assistant is asked to pair Ana with Carmen in "Tapas Night"', async () => {
      await callTool(client, 'set_partner', { contest: 'Tapas Night', person: 'Ana', partner: 'Carmen' });
    });
    Then('Ana and Carmen are partners in "Tapas Night"', async () => {
      expect(await pairings(client, 'Tapas Night')).toMatchObject({ Ana: 'Carmen', Carmen: 'Ana' });
    });
    /* The half a host never says out loud — and the half publishing would reject. */
    And('Bob has no partner in "Tapas Night"', async () => {
      expect((await pairings(client, 'Tapas Night')).Bob).toBeNull();
    });
    And('Dan has no partner in "Tapas Night"', async () => {
      expect((await pairings(client, 'Tapas Night')).Dan).toBeNull();
    });
  });

  Scenario('The assistant leaves someone without a partner', ({ Given, When, Then, And }) => {
    let client: Client;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" where Ana and Bob are partners',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await draftWithPeople(api, token, 'Tapas Night', [
          { displayName: 'Ana', partner: 'Bob' },
          { displayName: 'Bob', partner: 'Ana' },
        ]);
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When('the assistant is asked to leave Ana without a partner in "Tapas Night"', async () => {
      await callTool(client, 'set_partner', { contest: 'Tapas Night', person: 'Ana' });
    });
    Then('Ana has no partner in "Tapas Night"', async () => {
      expect((await pairings(client, 'Tapas Night')).Ana).toBeNull();
    });
    And('Bob has no partner in "Tapas Night"', async () => {
      expect((await pairings(client, 'Tapas Night')).Bob).toBeNull();
    });
  });

  Scenario('Pairing somebody who is not taking part changes nothing', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" with Ana and Bob taking part',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await draftWithPeople(api, token, 'Tapas Night', [
          { displayName: 'Ana' },
          { displayName: 'Bob' },
        ]);
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When('the assistant is asked to pair Ana with "Zoe" in "Tapas Night"', async () => {
      result = await callTool(client, 'set_partner', {
        contest: 'Tapas Night',
        person: 'Ana',
        partner: 'Zoe',
      });
    });
    Then('the request is refused because nobody by that name is taking part', () => {
      expect(result.isError).toBe(true);
      expect(text(result)).toMatch(/nobody called "Zoe" is taking part/i);
    });
    And('Ana has no partner in "Tapas Night"', async () => {
      expect((await pairings(client, 'Tapas Night')).Ana).toBeNull();
    });
  });

  Scenario('A name two people share is put back to the host', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" with two people called "Ana", and Bob taking part',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await draftWithPeople(api, token, 'Tapas Night', [
          { displayName: 'Ana' },
          { displayName: 'Ana' },
          { displayName: 'Bob' },
        ]);
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When('the assistant is asked to pair "Ana" with Bob in "Tapas Night"', async () => {
      result = await callTool(client, 'set_partner', {
        contest: 'Tapas Night',
        person: 'Ana',
        partner: 'Bob',
      });
    });
    Then('the request is refused because more than one person has that name', () => {
      expect(result.isError).toBe(true);
      expect(text(result)).toMatch(/more than one person/i);
    });
    And('nobody in "Tapas Night" has a partner', async () => {
      expect(Object.values(await pairings(client, 'Tapas Night')).every((v) => v === null)).toBe(true);
    });
  });

  Scenario('Pairing somebody with themselves is refused', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" with Ana and Bob taking part',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await draftWithPeople(api, token, 'Tapas Night', [
          { displayName: 'Ana' },
          { displayName: 'Bob' },
        ]);
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When('the assistant is asked to pair Ana with Ana in "Tapas Night"', async () => {
      result = await callTool(client, 'set_partner', {
        contest: 'Tapas Night',
        person: 'Ana',
        partner: 'Ana',
      });
    });
    Then('the request is refused because a person cannot be their own partner', () => {
      expect(result.isError).toBe(true);
      expect(text(result)).toMatch(/own partner/i);
    });
    And('Ana has no partner in "Tapas Night"', async () => {
      expect((await pairings(client, 'Tapas Night')).Ana).toBeNull();
    });
  });

  Scenario('Changing the format leaves the people and the scoring alone', ({ Given, When, Then, And }) => {
    let client: Client;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" judged on "Taste", with Ana and Bob taking part',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await draftWithPeople(api, token, 'Tapas Night', [
          { displayName: 'Ana' },
          { displayName: 'Bob' },
        ]);
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When(
      'the assistant is asked to make "Tapas Night" a contest where couples cook together',
      async () => {
        await callTool(client, 'set_format', { contest: 'Tapas Night', format: 'couples' });
      },
    );
    Then('"Tapas Night" is still judged on "Taste"', async () => {
      const details = body(await callTool(client, 'get_contest_details', { name: 'Tapas Night' }));
      expect((details.details as { categories: readonly string[] }).categories).toEqual(['Taste']);
    });
    And('Ana and Bob are still taking part in "Tapas Night"', async () => {
      const details = body(await callTool(client, 'get_contest_details', { name: 'Tapas Night' }));
      expect((details.details as { participants: readonly string[] }).participants).toEqual(['Ana', 'Bob']);
    });
  });

  Scenario('A format the people cannot yet satisfy is kept until publishing refuses it', ({ Given, When, Then, And }) => {
    let client: Client;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" with Ana and Bob taking part, nobody paired',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await draftWithPeople(api, token, 'Tapas Night', [
          { displayName: 'Ana' },
          { displayName: 'Bob' },
        ]);
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When(
      'the assistant is asked to make "Tapas Night" a contest where couples cook together',
      async () => {
        await callTool(client, 'set_format', { contest: 'Tapas Night', format: 'couples' });
      },
    );
    Then('"Tapas Night" is a contest where couples cook together', async () => {
      expect(await formatOf(client, 'Tapas Night')).toBe('couples');
    });
    /*
     * Where it is caught, and deliberately the only place: what is wrong with it
     * shows only against the whole contest. The form stores it too.
     */
    And('publishing "Tapas Night" is refused because somebody has no partner', async () => {
      const challenge = body(await callTool(client, 'publish_contest', { contest: 'Tapas Night' }));
      const published = await callTool(client, 'publish_contest', {
        contest: 'Tapas Night',
        confirmationToken: challenge.confirmationToken as string,
      });
      expect(published.isError).toBe(true);
      expect(text(published)).toMatch(/no partner/i);
    });
  });

  Scenario("A published contest's format cannot be changed", ({ Given, When, Then }) => {
    let client: Client;
    let result: ToolResult;

    Given(
      'a host with a personal access token and a published contest named "Tapas Night"',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await publishNamedContestAs(api.app, token, 'Tapas Night');
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When(
      'the assistant is asked to make "Tapas Night" a contest where couples cook together',
      async () => {
        result = await callTool(client, 'set_format', { contest: 'Tapas Night', format: 'couples' });
      },
    );
    Then('no draft is found', () => {
      expect(body(result)).toEqual({ candidates: [] });
    });
  });
});
