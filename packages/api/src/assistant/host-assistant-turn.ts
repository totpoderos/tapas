import type { LLMMessage } from '@tapas/shared';
import {
  TOOL_CATALOG,
  confirmationTokenFor,
  isValidConfirmation,
  parseToolArguments,
  readResolution,
  resolutionRequestFor,
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

/** One thing the assistant did, or was stopped by. The pieces a run is made of. */
export type AssistantStep =
  | { readonly kind: 'result'; readonly action: string; readonly text: string; readonly result: unknown }
  | {
      readonly kind: 'failed';
      readonly action: string;
      readonly message: string;
      /**
       * The refusal as the API classified it, when it classified one. The panel
       * has its own words for the refusals it knows and falls back to `message`
       * for the rest, so this is what lets a host read in Spanish why their
       * contest would not go live — the same sentence the form shows them.
       */
      readonly code?: string;
      readonly details?: Readonly<Record<string, unknown>>;
    }
  | {
      readonly kind: 'confirm';
      readonly action: string;
      readonly args: Record<string, unknown>;
      readonly confirmationToken: string;
      readonly message: string;
    };

export type AssistantTurn =
  | { readonly kind: 'reply'; readonly text: string }
  | AssistantStep
  /**
   * What happened when one message asked for several things: every step in the
   * order it was asked for, and the names of anything the run did not reach.
   *
   * A message asking for one thing still answers with that one step's own shape.
   * The overwhelmingly common case is left exactly as it was rather than wrapped
   * in a list of one.
   */
  | {
      readonly kind: 'steps';
      readonly steps: readonly AssistantStep[];
      /** Asked for, never attempted — because something before it stopped the run. */
      readonly notReached: readonly string[];
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
  return refusalOf(body).message;
}

/**
 * The refusal whole: its sentence, and — when the API classified one — the code
 * and the facts behind it.
 *
 * The sentence alone was all that used to be carried on, which left the panel
 * unable to say any of this in the host's language: a sentence is written in one
 * language and the reader cannot put it into another. The routes have always
 * sent `{ error }` wholesale; it was this step that narrowed it to a string.
 */
export function refusalOf(body: unknown): {
  readonly message: string;
  readonly code?: string;
  readonly details?: Readonly<Record<string, unknown>>;
} {
  const fallback = 'It could not be carried out.';
  if (!body || typeof body !== 'object' || !('error' in body)) return { message: fallback };

  const error = (body as { error: unknown }).error;
  if (!error || typeof error !== 'object') return { message: fallback };

  const { message, code, details } = error as { message?: unknown; code?: unknown; details?: unknown };
  return {
    message: typeof message === 'string' && message.trim() ? message.trim() : fallback,
    ...(typeof code === 'string' && code ? { code } : {}),
    ...(details && typeof details === 'object' && !Array.isArray(details)
      ? { details: details as Readonly<Record<string, unknown>> }
      : {}),
  };
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
  readonly execute: (request: ApiRequest, ran: RanTool) => Promise<ToolOutcome>;
}

/**
 * Which tool is being run, and what it was asked for.
 *
 * Handed to `execute` so the caller can record how the action arrived without
 * this module knowing anything about transports or audit logs. The turn still
 * decides *what* runs; the caller decides what that means on its own side.
 */
export interface RanTool {
  readonly toolName: string;
  readonly toolArgs: unknown;
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

/**
 * One conversational turn.
 *
 * A message may ask for several things. The model proposes an action for each,
 * in the order the host asked for them, and every one of them is carried out —
 * this used to take `toolCalls[0]` and discard the rest, so a host who asked for
 * six things got the first and no word about the other five.
 *
 * A run ends early on two things, and says so rather than hiding it: something
 * irreversible, which is put to the host on its own because a confirmation
 * approves the action it names and not a queue behind it; and something that
 * could not be done, because later steps lean on earlier ones and carrying on
 * turns one honest error into a run of confusing ones.
 */
export async function runAssistantMessage(
  messages: readonly LLMMessage[],
  deps: TurnDeps,
): Promise<AssistantTurn> {
  const completion = await deps.assistant.respond(messages);
  const calls = completion.toolCalls;
  if (calls.length === 0) return { kind: 'reply', text: completion.text };

  // One thing asked for answers in that one step's own shape, exactly as before.
  if (calls.length === 1) return runOneCall(calls[0]!, completion.text, deps);

  const steps: AssistantStep[] = [];
  for (const [index, call] of calls.entries()) {
    const outcome = await runOneCall(call, completion.text, deps);
    const step = asStep(outcome, call.name);
    steps.push(step);

    // A result is the only outcome that lets the run go on. A refusal, a
    // confirmation to give, or a call that could not even be understood all end
    // it — and whatever came after was never attempted.
    if (step.kind !== 'result') {
      return { kind: 'steps', steps, notReached: calls.slice(index + 1).map((rest) => rest.name) };
    }
  }
  return { kind: 'steps', steps, notReached: [] };
}

/**
 * A step, from whatever one call answered with.
 *
 * `runOneCall` can answer with a plain reply — an unknown tool, or arguments
 * that did not parse. Alone that is a sentence to the host; inside a run it is
 * that step failing, and the run stops there.
 */
function asStep(turn: AssistantTurn, action: string): AssistantStep {
  return turn.kind === 'reply' ? { kind: 'failed', action, message: turn.text } : (turn as AssistantStep);
}

/**
 * One proposed call, carried out.
 *
 * Every step of a run goes through here, so the schema check, the settling of a
 * name, the destructive gate and the audit provenance are the same whether a
 * message asked for one thing or six. A second way to run a tool would agree
 * with this one until the day one of them changed.
 */
async function runOneCall(
  call: { readonly name: string; readonly arguments: Record<string, unknown> },
  completionText: string,
  deps: TurnDeps,
): Promise<AssistantTurn> {
  const tool = TOOLS.get(call.name);
  if (!tool) return { kind: 'reply', text: completionText || 'I’m not sure how to help with that yet.' };

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

  if (tool.destructive) {
    /*
     * Settle which contest they mean before putting a confirmation card in front
     * of them. A name two of their contests share is a choice to make, not an
     * approval to give — the card would name an action that is not yet one
     * action. Answered as an ordinary result so the panel shows the candidates
     * the way it shows them for any other unresolved name.
     */
    const probe = resolutionRequestFor(tool, parsed.args);
    if (probe) {
      const found = await deps.execute(probe, { toolName: tool.name, toolArgs: parsed.args });
      if (!found.ok) return { kind: 'failed', action: tool.name, ...refusalOf(found.body) };
      const resolution = readResolution(found.body);
      if (resolution.kind === 'unresolved') {
        return {
          kind: 'result',
          action: tool.name,
          text: completionText,
          result: { candidates: resolution.candidates },
        };
      }
    }
    return askToConfirm(deps.confirmationSecret, tool, parsed.args);
  }

  const outcome = await deps.execute(tool.toRequest(parsed.args), { toolName: tool.name, toolArgs: parsed.args });
  if (!outcome.ok) return { kind: 'failed', action: tool.name, ...refusalOf(outcome.body) };
  return { kind: 'result', action: tool.name, text: completionText, result: outcome.body };
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

  const outcome = await deps.execute(tool.toRequest(parsed.args), { toolName: tool.name, toolArgs: parsed.args });
  if (!outcome.ok) return { kind: 'failed', action: tool.name, ...refusalOf(outcome.body) };
  return { kind: 'result', action: tool.name, text: '', result: outcome.body };
}
