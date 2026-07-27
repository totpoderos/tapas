import type { LLMMessage } from '@tapas/shared';
import {
  TOOL_CATALOG,
  confirmationTokenFor,
  isValidConfirmation,
  parseToolArguments,
  type ApiRequest,
  type HostAssistant,
  type McpTool,
} from '@tapas/mcp';

/**
 * The in-app host-assistant turn (design.md §7). Ties together three Phase-4
 * pieces — the `HostAssistant` (which proposes a tool call or asks to clarify),
 * the MCP tool catalog (names, destructive flags, `toRequest`), and the HMAC
 * confirmation gate — into a single conversational step. Executing a chosen tool
 * is delegated to `execute`, so this stays free of HTTP/transport concerns and
 * the same gate holds however the caller runs the request.
 *
 * A destructive tool is never run on a first proposal: the caller is handed a
 * confirmation to show the host and send back, and only a request carrying the
 * matching, action-bound token runs the action.
 */

/** A host confirming a destructive action, echoing the exact action + token it was given. */
export interface ConfirmRequest {
  readonly action: string;
  readonly args: Record<string, unknown>;
  readonly confirmationToken: string;
}

export type AssistantTurn =
  | { readonly kind: 'reply'; readonly text: string }
  | { readonly kind: 'result'; readonly action: string; readonly text: string; readonly result: unknown }
  | {
      readonly kind: 'confirm';
      readonly action: string;
      readonly args: Record<string, unknown>;
      readonly confirmationToken: string;
      readonly message: string;
    };

export interface TurnDeps {
  readonly assistant: HostAssistant;
  readonly confirmationSecret: string;
  /** Runs a tool's intended API request as the signed-in host, returning the response body. */
  readonly execute: (request: ApiRequest) => Promise<unknown>;
}

/** A confirmation was sent for an action that isn't a known destructive tool. */
export class UnknownActionError extends Error {}

const TOOLS = new Map<string, McpTool>(TOOL_CATALOG.map((tool) => [tool.name, tool]));

function askToConfirm(secret: string, tool: McpTool, args: Record<string, unknown>): AssistantTurn {
  return {
    kind: 'confirm',
    action: tool.name,
    args,
    confirmationToken: confirmationTokenFor(secret, tool.name, args),
    message: `This can’t be undone. Confirm to ${tool.name.replace(/_/g, ' ')}.`,
  };
}

/** One conversational turn: the assistant clarifies, runs a reversible action, or asks to confirm. */
export async function runAssistantMessage(
  messages: readonly LLMMessage[],
  deps: TurnDeps,
): Promise<AssistantTurn> {
  const completion = await deps.assistant.respond(messages);
  const call = completion.toolCalls[0];
  if (!call) return { kind: 'reply', text: completion.text };

  const tool = TOOLS.get(call.name);
  if (!tool) return { kind: 'reply', text: completion.text || 'I’m not sure how to help with that yet.' };

  // Check the model's arguments against the tool's own schema before anything
  // acts on them. The MCP server gets this from the SDK; this path has to ask.
  // A malformed call is reported back, never dispatched.
  const parsed = parseToolArguments(tool, call.arguments);
  if (!parsed.ok) {
    return {
      kind: 'reply',
      text: `I couldn’t do that — the details didn’t look right (${parsed.message}). Could you rephrase?`,
    };
  }

  if (tool.destructive) return askToConfirm(deps.confirmationSecret, tool, parsed.args);

  const result = await deps.execute(tool.toRequest(parsed.args));
  return { kind: 'result', action: tool.name, text: completion.text, result };
}

/** Carries out a destructive action once the host confirms it — only with the matching token. */
export async function runConfirmedAction(confirm: ConfirmRequest, deps: TurnDeps): Promise<AssistantTurn> {
  const tool = TOOLS.get(confirm.action);
  if (!tool || !tool.destructive) throw new UnknownActionError(confirm.action);

  // An absent, wrong, or different-action token fails here — a token minted for
  // one action will not validate another, so we re-ask rather than run it.
  if (!isValidConfirmation(deps.confirmationSecret, confirm.action, confirm.args, confirm.confirmationToken)) {
    return askToConfirm(deps.confirmationSecret, tool, confirm.args);
  }

  // The token proves the host approved these arguments; the schema proves they
  // are usable. Both must hold before a destructive action runs.
  const parsed = parseToolArguments(tool, confirm.args);
  if (!parsed.ok) {
    return { kind: 'reply', text: `I couldn’t do that — the details didn’t look right (${parsed.message}).` };
  }

  const result = await deps.execute(tool.toRequest(parsed.args));
  return { kind: 'result', action: tool.name, text: '', result };
}
