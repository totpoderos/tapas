import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { afterAll, expect } from 'vitest';
import { buildMcpServer } from '../../src/mcp-server.js';
import {
  hostWithToken,
  publishNamedContestAs,
  saveScoredDraftAs,
  startApi,
  type RunningApi,
} from '../support/api-harness.js';

const feature = await loadFeature(
  fileURLToPath(new URL('./shaping-a-drafts-scoring-through-an-assistant.feature', import.meta.url)),
);

interface ToolResult {
  readonly isError?: boolean;
  readonly content: readonly { readonly type: string; readonly text: string }[];
}

const judgedOn = (...names: string[]) => ({
  categories: names.map((name, i) => ({ id: `c${i}`, name })),
  range: { type: 'fixed', min: 1, max: 10 },
  uniquePerCategory: false,
});

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

/** The raw text of the first content block — a refusal is a message, not JSON. */
function text(result: ToolResult): string {
  const [block] = result.content;
  if (!block) throw new Error('tool result had no content');
  return block.text;
}

function body(result: ToolResult): Record<string, unknown> {
  const [block] = result.content;
  if (!block) throw new Error('tool result had no content');
  return JSON.parse(block.text) as Record<string, unknown>;
}

/** Sees a destructive tool through its confirmation, which is unchanged by this slice. */
async function confirming(
  client: Client,
  tool: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const challenge = body(await callTool(client, tool, args));
  const confirmationToken = challenge.confirmationToken as string | undefined;
  if (confirmationToken === undefined) throw new Error(`${tool} did not ask for a confirmation`);
  return callTool(client, tool, { ...args, confirmationToken });
}

/** What the draft is judged on now, read back the way a host would ask for it. */
async function judgedOnNow(client: Client, contest: string): Promise<readonly string[]> {
  const details = body(await callTool(client, 'get_contest_details', { name: contest }));
  return (details.details as { categories: readonly string[] } | undefined)?.categories ?? [];
}

/** The draft's scoring as stored — for the parts the details view does not carry. */
async function scoringOf(client: Client, contest: string): Promise<Record<string, unknown>> {
  const draft = body(await callTool(client, 'get_draft', { contest }));
  const content = draft.content as { scoring?: Record<string, unknown> } | undefined;
  return content?.scoring ?? {};
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

  Scenario('The assistant adds something for a draft to be judged on', ({ Given, When, Then }) => {
    let client: Client;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" judged on "Taste"',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await saveScoredDraftAs(api.app, token, 'Tapas Night', judgedOn('Taste'));
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When('the assistant is asked to judge "Tapas Night" on "Presentation" too', async () => {
      await callTool(client, 'add_category', { contest: 'Tapas Night', category: 'Presentation' });
    });
    Then('"Tapas Night" is judged on "Taste" and "Presentation"', async () => {
      expect(await judgedOnNow(client, 'Tapas Night')).toEqual(['Taste', 'Presentation']);
    });
  });

  Scenario('A category the draft is already judged on is refused', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" judged on "Taste"',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await saveScoredDraftAs(api.app, token, 'Tapas Night', judgedOn('Taste'));
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When('the assistant is asked to judge "Tapas Night" on "Taste" again', async () => {
      result = await callTool(client, 'add_category', { contest: 'Tapas Night', category: 'Taste' });
    });
    Then('the request is refused because the draft is already judged on that', () => {
      expect(result.isError).toBe(true);
      expect(text(result)).toMatch(/already judged on/i);
    });
    And('"Tapas Night" is judged on "Taste" alone', async () => {
      expect(await judgedOnNow(client, 'Tapas Night')).toEqual(['Taste']);
    });
  });

  Scenario('Removing something a draft is judged on waits to be confirmed', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" judged on "Taste" and "Presentation"',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await saveScoredDraftAs(api.app, token, 'Tapas Night', judgedOn('Taste', 'Presentation'));
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When(
      'the assistant is asked to stop judging "Tapas Night" on "Presentation", without confirming',
      async () => {
        result = await callTool(client, 'remove_category', {
          contest: 'Tapas Night',
          category: 'Presentation',
        });
      },
    );
    Then('"Tapas Night" is still judged on "Taste" and "Presentation"', async () => {
      expect(await judgedOnNow(client, 'Tapas Night')).toEqual(['Taste', 'Presentation']);
    });
    And('the assistant is told the action needs confirming', () => {
      expect(body(result)).toMatchObject({ confirmationRequired: true });
    });
  });

  Scenario('The assistant stops judging on something once the host confirms', ({ Given, When, Then }) => {
    let client: Client;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" judged on "Taste" and "Presentation"',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await saveScoredDraftAs(api.app, token, 'Tapas Night', judgedOn('Taste', 'Presentation'));
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When(
      'the assistant is asked to stop judging "Tapas Night" on "Presentation", confirming',
      async () => {
        await confirming(client, 'remove_category', { contest: 'Tapas Night', category: 'Presentation' });
      },
    );
    Then('"Tapas Night" is judged on "Taste" alone', async () => {
      expect(await judgedOnNow(client, 'Tapas Night')).toEqual(['Taste']);
    });
  });

  Scenario('Removing something the draft is not judged on changes nothing', ({ Given, When, Then, And }) => {
    let client: Client;
    let result: ToolResult;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" judged on "Taste"',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await saveScoredDraftAs(api.app, token, 'Tapas Night', judgedOn('Taste'));
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When(
      'the assistant is asked to stop judging "Tapas Night" on "Presentation", confirming',
      async () => {
        result = await confirming(client, 'remove_category', {
          contest: 'Tapas Night',
          category: 'Presentation',
        });
      },
    );
    Then('"Tapas Night" is judged on "Taste" alone', async () => {
      expect(await judgedOnNow(client, 'Tapas Night')).toEqual(['Taste']);
    });
    /*
     * Not a quiet "done" over an unchanged draft: the host has just confirmed a
     * removal, and being told it happened when it did not is the worst answer
     * available.
     */
    And('the answer says it was not judged on that', () => {
      expect(result.isError).toBe(true);
      expect(text(result)).toMatch(/not judged on/i);
    });
  });

  Scenario('The assistant sets the range scores are given within', ({ Given, When, Then }) => {
    let client: Client;

    Given('a host with a personal access token and a draft named "Tapas Night"', async () => {
      const api = await startTrackedApi();
      const token = await hostWithToken(api.app, api.db, 'ana@example.com');
      await saveScoredDraftAs(api.app, token, 'Tapas Night', judgedOn('Taste'));
      client = await connectAssistant(api.baseUrl, token);
    });
    When('the assistant is asked to score "Tapas Night" between 1 and 10', async () => {
      await callTool(client, 'set_score_range', { contest: 'Tapas Night', min: 1, max: 10 });
    });
    Then('"Tapas Night" is scored between 1 and 10', async () => {
      expect((await scoringOf(client, 'Tapas Night')).range).toEqual({ type: 'fixed', min: 1, max: 10 });
    });
  });

  Scenario('The assistant lets the range be worked out from the contest', ({ Given, When, Then }) => {
    let client: Client;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" scored between 1 and 10',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await saveScoredDraftAs(api.app, token, 'Tapas Night', judgedOn('Taste'));
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When('the assistant is asked to let "Tapas Night" work its own range out', async () => {
      await callTool(client, 'set_score_range', { contest: 'Tapas Night' });
    });
    Then('"Tapas Night" works its range out from the contest', async () => {
      expect((await scoringOf(client, 'Tapas Night')).range).toEqual({ type: 'auto' });
    });
  });

  Scenario('The assistant settles that each score may be used only once', ({ Given, When, Then }) => {
    let client: Client;

    Given('a host with a personal access token and a draft named "Tapas Night"', async () => {
      const api = await startTrackedApi();
      const token = await hostWithToken(api.app, api.db, 'ana@example.com');
      await saveScoredDraftAs(api.app, token, 'Tapas Night', judgedOn('Taste'));
      client = await connectAssistant(api.baseUrl, token);
    });
    When(
      'the assistant is asked that each score in "Tapas Night" be used only once per category',
      async () => {
        await callTool(client, 'set_score_uniqueness', { contest: 'Tapas Night', uniquePerCategory: true });
      },
    );
    Then('"Tapas Night" requires a different score for each dish in a category', async () => {
      expect((await scoringOf(client, 'Tapas Night')).uniquePerCategory).toBe(true);
    });
  });

  Scenario('The assistant settles that a score may be repeated', ({ Given, When, Then }) => {
    let client: Client;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" where each score is used only once',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await saveScoredDraftAs(api.app, token, 'Tapas Night', {
          ...judgedOn('Taste'),
          uniquePerCategory: true,
        });
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When('the assistant is asked to let scores repeat in "Tapas Night"', async () => {
      await callTool(client, 'set_score_uniqueness', { contest: 'Tapas Night', uniquePerCategory: false });
    });
    Then('"Tapas Night" allows the same score for more than one dish in a category', async () => {
      expect((await scoringOf(client, 'Tapas Night')).uniquePerCategory).toBe(false);
    });
  });

  Scenario('Changing one part of the scoring leaves the rest alone', ({ Given, When, Then, And }) => {
    let client: Client;

    Given(
      'a host with a personal access token and a draft named "Tapas Night" judged on "Taste", scored between 1 and 10, with Ana and Bob taking part',
      async () => {
        const api = await startTrackedApi();
        const token = await hostWithToken(api.app, api.db, 'ana@example.com');
        await saveScoredDraftAs(api.app, token, 'Tapas Night', judgedOn('Taste'), ['Ana', 'Bob']);
        client = await connectAssistant(api.baseUrl, token);
      },
    );
    When('the assistant is asked to let "Tapas Night" work its own range out', async () => {
      await callTool(client, 'set_score_range', { contest: 'Tapas Night' });
    });
    Then('"Tapas Night" is still judged on "Taste"', async () => {
      expect(await judgedOnNow(client, 'Tapas Night')).toEqual(['Taste']);
    });
    And('Ana and Bob are still taking part in "Tapas Night"', async () => {
      const details = body(await callTool(client, 'get_contest_details', { name: 'Tapas Night' }));
      expect((details.details as { participants: readonly string[] }).participants).toEqual(['Ana', 'Bob']);
    });
  });

  Scenario("A published contest's scoring cannot be changed", ({ Given, When, Then, And }) => {
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
    When('the assistant is asked to judge "Tapas Night" on "Presentation"', async () => {
      result = await callTool(client, 'add_category', { contest: 'Tapas Night', category: 'Presentation' });
    });
    /*
     * Not a refusal: the scoring routes look only at drafts, so a published
     * contest of that name is not there to change — the same answer as a name
     * nobody has, which is what the host is told.
     */
    Then('no draft is found', () => {
      expect(body(result)).toEqual({ candidates: [] });
    });
    And('the published contest is unchanged', async () => {
      const details = body(await callTool(client, 'get_contest_details', { name: 'Tapas Night' }));
      expect((details.details as { categories: readonly string[] }).categories).not.toContain('Presentation');
    });
  });

  Scenario('A range that makes no sense is kept until publishing refuses it', ({ Given, When, Then, And }) => {
    let client: Client;

    Given('a host with a personal access token and a draft named "Tapas Night"', async () => {
      const api = await startTrackedApi();
      const token = await hostWithToken(api.app, api.db, 'ana@example.com');
      await saveScoredDraftAs(api.app, token, 'Tapas Night', judgedOn('Taste'));
      client = await connectAssistant(api.baseUrl, token);
    });
    When('the assistant is asked to score "Tapas Night" between 5 and 2', async () => {
      await callTool(client, 'set_score_range', { contest: 'Tapas Night', min: 5, max: 2 });
    });
    Then('"Tapas Night" is scored between 5 and 2', async () => {
      expect((await scoringOf(client, 'Tapas Night')).range).toEqual({ type: 'fixed', min: 5, max: 2 });
    });
    /*
     * Where it is caught, and deliberately the only place: what is wrong with
     * the range shows only against the whole contest. The form stores it too,
     * and this is the check both of them meet.
     */
    And(
      'publishing "Tapas Night" is refused because the range is not one scores can be given in',
      async () => {
        const published = await confirming(client, 'publish_contest', { contest: 'Tapas Night' });
        expect(published.isError).toBe(true);
        expect(text(published)).toMatch(/range/i);
      },
    );
  });
});
