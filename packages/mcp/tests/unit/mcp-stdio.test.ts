import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { createConfiguredMcpServer } from '../../src/mcp-stdio.js';
import type { Env } from '../../src/config/env.js';

const ENV: Env = {
  NODE_ENV: 'test',
  API_BASE_URL: 'http://api.test',
  MCP_HOST_TOKEN: 'pat-abc',
  MCP_CONFIRMATION_SECRET: 'a-confirmation-secret-of-32-chars!!',
};

describe('createConfiguredMcpServer', () => {
  it('builds a server that exposes the whole tool catalog to a client', async () => {
    const server = createConfiguredMcpServer(ENV);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test', version: '0.0.0' });
    await client.connect(clientTransport);

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'close_contest',
      'get_contest',
      'get_draft',
      'get_tally',
    ]);
    await client.close();
  });
});
