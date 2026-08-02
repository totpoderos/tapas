import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { SqliteAuditLogRepository } from '@tapas/api';
import { afterEach, describe, expect, it } from 'vitest';
import { buildMcpServer } from '../../src/mcp-server.js';
import { hostWithToken, startApi, type RunningApi } from '../support/api-harness.js';

/**
 * The MCP server as an integration boundary (design.md §6, task 4.9). Destructive
 * enforcement has its own end-to-end coverage in
 * `confirming-destructive-actions-through-an-assistant.feature`; here we pin the
 * other two boundary properties: the tool schema is enforced before anything
 * reaches the API, and an action taken through the server is recorded in the
 * API's audit log.
 */
const SECRET = 'a-confirmation-secret-of-32-chars!!';

interface ToolResult {
  readonly content: readonly { readonly type: string; readonly text: string }[];
}

describe('MCP server boundary', () => {
  let api: RunningApi | undefined;
  afterEach(async () => {
    await api?.close();
    api = undefined;
  });

  async function connect(token: string): Promise<Client> {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = buildMcpServer({ apiBaseUrl: api!.baseUrl, hostToken: token, confirmationSecret: SECRET });
    await server.connect(serverTransport);
    const client = new Client({ name: 'boundary-test', version: '0.0.0' });
    await client.connect(clientTransport);
    return client;
  }

  it('rejects a tool call whose arguments break the tool schema', async () => {
    api = await startApi();
    const client = await connect(await hostWithToken(api.app, api.db, 'ana@example.com'));

    // get_contest requires a string contestId; a number is the wrong type. The SDK
    // validates against the tool schema, so the call is rejected — surfaced either
    // as a thrown protocol error or an error result — not dispatched as-is.
    let rejected = false;
    try {
      const result = (await client.callTool({
        name: 'get_contest',
        arguments: { contestId: 123 },
      })) as { isError?: boolean };
      rejected = result.isError === true;
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  });

  /*
   * The API writes its refusals for hosts to read, and that sentence is the
   * whole point of refusing. It used to be dropped in favour of the bare error
   * code, so an external assistant could say that something failed but not what
   * to do about it — while the in-app assistant showed the reason. One failure
   * reaching two paths as two different answers is the shape this repo keeps
   * paying for, so it is pinned here.
   */
  it("carries the API's reason for a refusal, not just its code", async () => {
    api = await startApi();
    const token = await hostWithToken(api.app, api.db, 'ana@example.com');
    const client = await connect(token);

    await client.callTool({ name: 'create_draft', arguments: { name: 'Tapas Night' } });
    await client.callTool({
      name: 'add_category',
      arguments: { contest: 'Tapas Night', category: 'Taste' },
    });
    const again = (await client.callTool({
      name: 'add_category',
      arguments: { contest: 'Tapas Night', category: 'Taste' },
    })) as ToolResult & { isError?: boolean };

    expect(again.isError).toBe(true);
    expect(again.content[0]!.text).toMatch(/already judged on "Taste"/i);
  });

  it('records an audit entry for an action taken through the server', async () => {
    api = await startApi();
    const client = await connect(await hostWithToken(api.app, api.db, 'ana@example.com'));

    const result = (await client.callTool({
      name: 'create_draft',
      arguments: { name: 'Audited Tapas' },
    })) as ToolResult;
    const draftId = JSON.parse(result.content[0]!.text).id as string;

    const entries = new SqliteAuditLogRepository(api.db).findByContest(draftId);
    expect(entries.some((entry) => entry.type === 'draft.saved')).toBe(true);
  });
});
