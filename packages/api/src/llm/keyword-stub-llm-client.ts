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
 *   anything else                       → a plain reply asking to clarify
 *
 * The contest id is read straight out of the message so the E2E, which knows the
 * id it seeded, can steer the stub deterministically.
 */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const DRAFT_CALLED = /draft called ["']?(.+?)["']?\s*$/i;

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

    return { text: 'Which contest do you mean?', toolCalls: [] };
  }
}
