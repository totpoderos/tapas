import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { dispatchToApi, type ApiDispatcherDeps, type DispatchResult } from './api-dispatcher.js';
import { confirmationTokenFor, isValidConfirmation } from './confirmation-token.js';
import { TOOL_CATALOG, type McpTool } from './tool-catalog.js';

/**
 * Builds the MCP protocol server (design.md §6.3): a thin adapter that exposes
 * the tool catalog and, for each call, forwards an API request as the connected
 * host and relays the result. It is bound to one host's personal access token —
 * a connection acts as exactly one host, and the API enforces what that host may
 * do. Destructive tools are additionally gated behind a confirmation the server
 * itself issues (design.md §7.1). No transport is attached here; the caller
 * connects one (in-memory in tests, stdio/HTTP in production).
 */
export interface McpServerDeps extends ApiDispatcherDeps {
  /** Secret keying the destructive-action confirmation tokens (design.md §7.1). */
  readonly confirmationSecret: string;
}

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
      async (rawArgs) => {
        const args = rawArgs as Record<string, unknown>;
        // A destructive tool runs only with a valid, server-issued confirmation
        // for this exact action; otherwise it is not dispatched — the client is
        // handed the confirmation to show the host and send back.
        if (tool.destructive && !isValidConfirmation(deps.confirmationSecret, tool.name, args, args.confirmationToken)) {
          return confirmationRequired(deps.confirmationSecret, tool, args);
        }
        return toToolResult(await dispatchToApi(deps, tool.toRequest(args)));
      },
    );
  }

  return server;
}

/** The "not executed — confirm first" result, carrying the token the client must send back. */
function confirmationRequired(secret: string, tool: McpTool, args: Record<string, unknown>) {
  const payload = {
    confirmationRequired: true,
    action: tool.name,
    confirmationToken: confirmationTokenFor(secret, tool.name, args),
    message: `This is a destructive action (${tool.name}) and was not carried out. To confirm, call ${tool.name} again with the confirmationToken above.`,
  };
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
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
        ? 'Not allowed — it belongs to a different host.'
        : result.status === 404
          ? 'Not found.'
          : `The request failed (status ${result.status}).`;
  /*
   * The API writes its refusals for hosts to read — "This contest is already
   * judged on Taste" — and that sentence is the whole point of refusing. It used
   * to be dropped here in favour of the bare code, so an external assistant
   * could only report that something failed and not what to do about it, while
   * the in-app assistant showed the reason (see `refusalMessage` in
   * host-assistant-turn.ts). One failure, two paths, two different answers.
   */
  const { code, message } = errorFields(result.body);
  const detail = [message, code && `(${code})`].filter(Boolean).join(' ');
  return detail ? `${base} ${detail}` : base;
}

/** The API's error envelope is `{ error: { code, message } }`. */
function errorFields(body: unknown): { code?: string; message?: string } {
  if (typeof body !== 'object' || body === null) return {};
  const error = (body as Record<string, unknown>).error;
  if (typeof error !== 'object' || error === null) return {};
  const record = error as Record<string, unknown>;
  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    message: typeof record.message === 'string' && record.message.trim() ? record.message.trim() : undefined,
  };
}
