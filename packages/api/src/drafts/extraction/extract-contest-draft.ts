import type { LLMClient } from '@tapas/shared';
import {
  NON_DEFAULTABLE_FIELDS,
  PROPOSE_CONTEST_DRAFT_TOOL,
  ProposedDraftSchema,
  type ProposedDraft,
} from './contest-draft-tool.js';

export interface ExtractContestDraftDeps {
  readonly llmClient: LLMClient;
}

type ExtractedFields = Omit<ProposedDraft, 'clarifications'>;

export interface ExtractContestDraftResult {
  readonly draft: ExtractedFields;
  readonly clarifications: readonly string[];
}

const NON_DEFAULTABLE = new Set<string>(NON_DEFAULTABLE_FIELDS);

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
 * best-effort partial draft from a single free-form host message. Does not
 * merge a follow-up host reply — that is a separate phase (Slice F2).
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

    // Two-phase validation (design.md §11B.2): the tool schema structurally
    // bounds the shape, but the model's honoring of it is never trusted —
    // re-validate with Zod before this output is used for anything.
    const parsed = ProposedDraftSchema.safeParse(call.arguments);
    if (!parsed.success) return { draft: {}, clarifications: [CANNOT_EXTRACT_MESSAGE] };

    const { clarifications, ...fields } = parsed.data;
    const guardedClarifications = [...clarifications];
    const draft: ExtractedFields = {};

    applyField(draft, guardedClarifications, 'name', fields.name, 'the contest name');
    applyField(draft, guardedClarifications, 'attribution', fields.attribution, 'attribution');
    applyField(draft, guardedClarifications, 'antiBias', fields.antiBias, 'the anti-bias rule');
    applyField(draft, guardedClarifications, 'scoring', fields.scoring, 'the scoring rules');
    applyField(draft, guardedClarifications, 'participants', fields.participants, 'the participants');
    applyField(draft, guardedClarifications, 'closeRule', fields.closeRule, 'the close rule');
    applyField(
      draft,
      guardedClarifications,
      'revealStrategy',
      fields.revealStrategy,
      'the reveal strategy',
    );

    return { draft, clarifications: guardedClarifications };
  }
}

/**
 * Applies one extracted field to the draft, unless it is a defaulted
 * high-stakes field (design.md §9) — those are dropped and a clarification
 * is added instead, regardless of what the system prompt asked for. Defense
 * in depth: the guard does not depend on the model having followed it.
 */
function applyField<K extends keyof ExtractedFields>(
  draft: ExtractedFields,
  clarifications: string[],
  key: K,
  field: ExtractedFields[K],
  label: string,
): void {
  if (!field) return;
  if (NON_DEFAULTABLE.has(key) && field.source === 'llm_default') {
    clarifications.push(`Please specify ${label} explicitly — I can't default that for you.`);
    return;
  }
  draft[key] = field;
}
