import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Env } from './config/env.js';
import { buildMcpServer } from './mcp-server.js';

/**
 * Wires the validated environment into a ready MCP server: the connection acts
 * as one host (its personal access token), talks to the API at `API_BASE_URL`,
 * and keys destructive-action confirmations with the configured secret.
 */
export function createConfiguredMcpServer(env: Env): McpServer {
  return buildMcpServer({
    apiBaseUrl: env.API_BASE_URL,
    hostToken: env.MCP_HOST_TOKEN,
    confirmationSecret: env.MCP_CONFIRMATION_SECRET,
  });
}

/**
 * Runs the server over stdio — the transport an MCP client (Claude Desktop, or
 * any other) uses when it spawns the server as a subprocess. Nothing may be
 * written to stdout except the protocol itself, so logging goes to stderr.
 */
export async function runStdioServer(env: Env): Promise<void> {
  const server = createConfiguredMcpServer(env);
  await server.connect(new StdioServerTransport());
  process.stderr.write(`[mcp] ready over stdio — API at ${env.API_BASE_URL}\n`);
}
