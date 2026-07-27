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
  | { readonly kind: 'failed'; readonly action: string; readonly message: string }
  | {
      readonly kind: 'confirm';
      readonly action: string;
      readonly args: Record<string, unknown>;
      readonly confirmationToken: string;
      readonly message: string;
    };

/** What came back from running a tool: the API accepted it, or refused with a reason. */
export type ToolOutcome =
  | { readonly ok: true; readonly body: unknown }
  | { readonly ok: false; readonly body: unknown };

/**
 * The host-facing reason a call was refused. The API already writes these for
 * hosts ("The draft is missing its scoring rules."), so it is shown as-is rather
 * than replaced with something vaguer — hiding the reason is what leaves someone
 * stuck. Falls back to a plain sentence when a response carries no message.
 */
export function refusalMessage(body: unknown): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as { error: unknown }).error;
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message.trim();
    }
  }
  return 'It could not be carried out.';
}

export interface TurnDeps {
  readonly assistant: HostAssistant;
  readonly confirmationSecret: string;
  /**
   * Runs a tool's intended API request as the signed-in host.
   *
   * Reports whether the API accepted it, not only what came back: a refused call
   * used to be handed on as if it were a result, so the host was shown "done"
   * for something that had not happened, and the reason was dropped.
   */
  readonly execute: (request: ApiRequest) => Promise<ToolOutcome>;
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

  const outcome = await deps.execute(tool.toRequest(parsed.args));
  if (!outcome.ok) return { kind: 'failed', action: tool.name, message: refusalMessage(outcome.body) };
  return { kind: 'result', action: tool.name, text: completion.text, result: outcome.body };
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

  const outcome = await deps.execute(tool.toRequest(parsed.args));
  if (!outcome.ok) return { kind: 'failed', action: tool.name, message: refusalMessage(outcome.body) };
  return { kind: 'result', action: tool.name, text: '', result: outcome.body };
}
