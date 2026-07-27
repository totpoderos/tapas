import type { LLMClient, LLMCompletion, LLMCompletionRequest } from '@tapas/shared';

/**
 * A deterministic, keyword-driven LLM stand-in — used ONLY when the API is run
 * with `ASSISTANT_STUB=1`, so a whole-system E2E can drive the assistant's
 * propose → confirm → act loop without a live model (which isn't available
 * headless). It is never selected in production. It reads the host's latest
 * message and maps a couple of fixed phrasings to a tool call:
 *
 *   "start a draft called X"            → create_draft { name: "X" }  (reversible)
 *   "close ... <contest-id>"            → close_contest { contestId }  (destructive)
 *   "list my contests"                  → list_my_contests {}          (reversible)
 *   "find <name>"                       → find_contest { name }        (reversible)
 *   "details of <name>" / "who's in <name>" → get_contest_details { name } (reversible)
 *   anything else                       → a plain reply asking to clarify
 *
 * The contest id is read straight out of the message so the E2E, which knows the
 * id it seeded, can steer the stub deterministically.
 */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const DRAFT_CALLED = /draft called ["']?(.+?)["']?\s*$/i;
const DETAILS_OF = /(?:details of|who(?:'s| is) (?:in|taking part in))\s+["']?(.+?)["']?\s*$/i;
const FIND_NAMED = /\bfind\b(?:\s+the)?(?:\s+contest)?\s+["']?(.+?)["']?\s*$/i;

export class KeywordStubLLMClient implements LLMClient {
  async complete(request: LLMCompletionRequest): Promise<LLMCompletion> {
    const latest = [...request.messages].reverse().find((message) => message.role === 'user');
    const text = latest?.content ?? '';

    const draftMatch = DRAFT_CALLED.exec(text);
    if (draftMatch) {
      return { text: 'Done — I saved your draft.', toolCalls: [{ name: 'create_draft', arguments: { name: draftMatch[1] } }] };
    }

    const idMatch = UUID.exec(text);
    if (/\bclose\b/i.test(text) && idMatch) {
      return { text: '', toolCalls: [{ name: 'close_contest', arguments: { contestId: idMatch[0] } }] };
    }

    if (/\blist\b/i.test(text) && /contest/i.test(text)) {
      return { text: 'Here are your contests.', toolCalls: [{ name: 'list_my_contests', arguments: {} }] };
    }

    const detailsMatch = DETAILS_OF.exec(text);
    if (detailsMatch) {
      return { text: '', toolCalls: [{ name: 'get_contest_details', arguments: { name: detailsMatch[1] } }] };
    }

    const findMatch = FIND_NAMED.exec(text);
    if (findMatch) {
      return { text: '', toolCalls: [{ name: 'find_contest', arguments: { name: findMatch[1] } }] };
    }

    return { text: 'Which contest do you mean?', toolCalls: [] };
  }
}
