import type { LLMClient, LLMCompletion, LLMCompletionRequest } from '@tapas/shared';

/**
 * A deterministic, keyword-driven LLM stand-in — used ONLY when the API is run
 * with `ASSISTANT_STUB=1`, so a whole-system E2E can drive the assistant's
 * propose → confirm → act loop without a live model (which isn't available
 * headless). It is never selected in production. It reads the host's latest
 * message and maps a couple of fixed phrasings to a tool call:
 *
 *   "set up X with A and B, and C and D taking part"
 *                                       → create_draft + add_category × N + add_participant × N,
 *                                         all in one completion (a message may ask for several things)
 *   "everyone on their own in X"        → set_format { contest, format: 'solo' }
 *   "start a draft called X"            → create_draft { name: "X" }  (reversible)
 *   "close <name>"                      → close_contest { contest }    (destructive)
 *   "list my contests"                  → list_my_contests {}          (reversible)
 *   "find <name>"                       → find_contest { name }        (reversible)
 *   "details of <name>" / "who's in <name>" → get_contest_details { name } (reversible)
 *   "add <person> to <contest>"         → add_participant { contest, participant } (reversible)
 *   "remove <person> from <contest>"    → remove_participant { contest, participant } (destructive)
 *   anything else                       → a plain reply asking to clarify
 *
 * The contest's NAME is read straight out of the message so the E2E, which knows
 * the name it seeded, can steer the stub deterministically — the same way the
 * host does, now that a name is the only way the assistant addresses a contest.
 */
const CLOSE_NAMED = /\bclose\b(?:\s+(?:my|the))?(?:\s+contest)?\s+["']?(.+?)["']?\s*$/i;
const DRAFT_CALLED = /draft called ["']?(.+?)["']?\s*$/i;
const DETAILS_OF = /(?:details of|who(?:'s| is) (?:in|taking part in))\s+["']?(.+?)["']?\s*$/i;
const ADD_TO = /\badd\s+["']?(.+?)["']?\s+to\s+["']?(.+?)["']?\s*$/i;
const REMOVE_FROM = /\bremove\s+["']?(.+?)["']?\s+from\s+["']?(.+?)["']?\s*$/i;
// "set up <name> judged on <a, b> with <c, d, e> taking part"
const SET_UP_WITH = /\bset up\s+["']?(.+?)["']?\s+judged on\s+(.+?)\s+with\s+(.+?)\s+taking part/i;
const FIND_NAMED = /\bfind\b(?:\s+the)?(?:\s+contest)?\s+["']?(.+?)["']?\s*$/i;
// "everyone on their own in <name>" — the answer to the one question a host who
// sets a contest up in one message never thinks to answer.
const EVERYONE_ON_THEIR_OWN = /\beveryone(?:'s| is)? on their own in\s+["']?(.+?)["']?\s*$/i;

export class KeywordStubLLMClient implements LLMClient {
  async complete(request: LLMCompletionRequest): Promise<LLMCompletion> {
    const latest = [...request.messages].reverse().find((message) => message.role === 'user');
    const text = latest?.content ?? '';

    /*
     * One message asking for several things, which is what a real model proposes
     * for "create a contest called X, judge it on A and B, with C, D and E
     * taking part". The stub has to be able to answer with a run of calls or the
     * E2E can only ever prove the single-call path.
     */
    const setUp = SET_UP_WITH.exec(text);
    if (setUp) {
      const contest = setUp[1]!.trim();
      const listed = (part: string | undefined) =>
        (part ?? '')
          .split(/,| and /i)
          .map((item) => item.trim())
          .filter(Boolean);
      return {
        text: '',
        toolCalls: [
          { name: 'create_draft', arguments: { name: contest } },
          ...listed(setUp[2]).map((category) => ({ name: 'add_category', arguments: { contest, category } })),
          ...listed(setUp[3]).map((participant) => ({
            name: 'add_participant',
            arguments: { contest, participant },
          })),
        ],
      };
    }

    const formatMatch = EVERYONE_ON_THEIR_OWN.exec(text);
    if (formatMatch) {
      return {
        text: '',
        toolCalls: [{ name: 'set_format', arguments: { contest: formatMatch[1], format: 'solo' } }],
      };
    }

    const draftMatch = DRAFT_CALLED.exec(text);
    if (draftMatch) {
      return { text: 'Done — I saved your draft.', toolCalls: [{ name: 'create_draft', arguments: { name: draftMatch[1] } }] };
    }

    const closeMatch = CLOSE_NAMED.exec(text);
    if (closeMatch) {
      return { text: '', toolCalls: [{ name: 'close_contest', arguments: { contest: closeMatch[1] } }] };
    }

    if (/\blist\b/i.test(text) && /contest/i.test(text)) {
      return { text: 'Here are your contests.', toolCalls: [{ name: 'list_my_contests', arguments: {} }] };
    }

    const detailsMatch = DETAILS_OF.exec(text);
    if (detailsMatch) {
      return { text: '', toolCalls: [{ name: 'get_contest_details', arguments: { name: detailsMatch[1] } }] };
    }

    const removeMatch = REMOVE_FROM.exec(text);
    if (removeMatch) {
      return { text: '', toolCalls: [{ name: 'remove_participant', arguments: { contest: removeMatch[2], participant: removeMatch[1] } }] };
    }

    const addMatch = ADD_TO.exec(text);
    if (addMatch) {
      return { text: '', toolCalls: [{ name: 'add_participant', arguments: { contest: addMatch[2], participant: addMatch[1] } }] };
    }

    const findMatch = FIND_NAMED.exec(text);
    if (findMatch) {
      return { text: '', toolCalls: [{ name: 'find_contest', arguments: { name: findMatch[1] } }] };
    }

    return { text: 'Which contest do you mean?', toolCalls: [] };
  }
}
