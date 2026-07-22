import type { LLMClient } from '@tapas/shared';
import { PROPOSE_CONTEST_DRAFT_TOOL } from './contest-draft-tool.js';
import {
  guardProposedFields,
  parseProposedDraft,
  type ExtractedFields,
} from './proposed-draft-guard.js';

export interface ExtractContestDraftDeps {
  readonly llmClient: LLMClient;
}

export interface ExtractContestDraftResult {
  readonly draft: ExtractedFields;
  readonly clarifications: readonly string[];
}

const CANNOT_EXTRACT_MESSAGE =
  'I could not extract a draft from that message — please try describing the contest again, or use the form.';

const SYSTEM_PROMPT = `You turn a host's free-form description of a tapas contest into a
structured draft, by calling the propose_contest_draft tool.

For each field, include it only if you can determine it, and tag it with a
source: "host" (the host said it outright), "llm_extracted" (you read it off
what the host said, e.g. inferring categories from "three criteria"), or
"llm_default" (you are proposing a sensible default the host did not
mention).

You may propose a "llm_default" ONLY for: name, closeRule, revealStrategy.
For attribution, antiBias, scoring, and participants, NEVER guess a default —
if the host did not say enough to determine one of these with confidence,
leave it out and explain what you need in clarifications.

List every field you left out — and why — in clarifications, in plain
language a non-technical host would understand.`;

/**
 * Phase 1 of the two-phase contest-creation chat (design.md §8): extracts a
 * best-effort partial draft from a single free-form host message. Merging a
 * follow-up host reply into that draft is the second phase — see
 * `MergeContestDraft`.
 */
export class ExtractContestDraft {
  constructor(private readonly deps: ExtractContestDraftDeps) {}

  async execute(message: string): Promise<ExtractContestDraftResult> {
    const completion = await this.deps.llmClient.complete({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
      tools: [PROPOSE_CONTEST_DRAFT_TOOL],
    });

    const call = completion.toolCalls.find((c) => c.name === 'propose_contest_draft');
    if (!call) return { draft: {}, clarifications: [CANNOT_EXTRACT_MESSAGE] };

    // Re-validated per field (design.md §11B.2) — one unusable field costs
    // only that field, not the whole extraction.
    const parsed = parseProposedDraft(call.arguments);
    if (!parsed) return { draft: {}, clarifications: [CANNOT_EXTRACT_MESSAGE] };
    return guardProposedFields(parsed.fields, parsed.clarifications);
  }
}
