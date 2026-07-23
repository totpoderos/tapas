import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { dispatchToApi, type ApiDispatcherDeps, type DispatchResult } from './api-dispatcher.js';
import { TOOL_CATALOG } from './tool-catalog.js';

/**
 * Builds the MCP protocol server (design.md §6.3): a thin adapter that exposes
 * the tool catalog and, for each call, forwards an API request as the connected
 * host and relays the result. It is bound to one host's personal access token —
 * a connection acts as exactly one host, and the API enforces what that host may
 * do. No transport is attached here; the caller connects one (in-memory in
 * tests, stdio/HTTP in production).
 */
export type McpServerDeps = ApiDispatcherDeps;

export function buildMcpServer(deps: McpServerDeps): McpServer {
  const server = new McpServer({ name: 'tapas-mcp', version: '0.0.0' });

  for (const tool of TOOL_CATALOG) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { readOnlyHint: !tool.destructive, destructiveHint: tool.destructive },
      },
      async (args) => toToolResult(await dispatchToApi(deps, tool.toRequest(args as Record<string, unknown>))),
    );
  }

  return server;
}

/** A successful API body is returned as text; a failure becomes an `isError` result the model can read. */
function toToolResult(result: DispatchResult) {
  if (result.ok) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(result.body) }] };
  }
  return { content: [{ type: 'text' as const, text: describeFailure(result) }], isError: true };
}

function describeFailure(result: DispatchResult): string {
  const base =
    result.status === 401
      ? 'Not authorized — the personal access token is missing or invalid.'
      : result.status === 403
        ? 'Not allowed — that contest belongs to a different host.'
        : result.status === 404
          ? 'No such contest.'
          : `The request failed (status ${result.status}).`;
  const code = errorCode(result.body);
  return code ? `${base} (${code})` : base;
}

/** The API's error envelope is `{ error: { code, message } }`; surface the code when present. */
function errorCode(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const error = (body as Record<string, unknown>).error;
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as Record<string, unknown>).code;
  return typeof code === 'string' ? code : undefined;
}
