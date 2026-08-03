import { compile, type CompileErrorCode } from '../compile.js';
import type { CloseRule, DraftContent, RevealStrategy } from '../draft/draft-content.js';
import { stillNeeded, type DraftGap } from '../draft/still-needed.js';
import type { ContestDraft, MaterializedContest } from '../model.js';

export type PublishErrorCode = 'INCOMPLETE_DRAFT' | CompileErrorCode;

export interface PublishError {
  readonly code: PublishErrorCode;
  readonly message: string;
}

export type PublishResult =
  | { readonly ok: true; readonly contest: Contest }
  | { readonly ok: false; readonly error: PublishError };

/** The minimum a use case must hand `Contest.publish`. */
export interface PublishableDraft {
  readonly id: string;
  readonly hostId: string;
  readonly content: DraftContent;
}

const DEFAULT_CLOSE_RULE: CloseRule = { when: 'all_sent' };
const DEFAULT_REVEAL_STRATEGY: RevealStrategy = { when: 'host_trigger' };

/**
 * A live contest, produced by publishing a draft. Publishing assembles the
 * draft's configuration into a compiler input, compiles it (fixing the scoring
 * rules), and pairs the result with a join code. The join code is generated
 * outside the domain and passed in. `closeRule`/`revealStrategy` default per
 * the allow-listed LLM defaults (design.md §11A.5) when the draft left them
 * unspecified.
 */
export class Contest {
  readonly status = 'live' as const;

  private constructor(
    readonly id: string,
    readonly hostId: string,
    readonly name: string,
    readonly joinCode: string,
    readonly materialized: MaterializedContest,
    readonly closeRule: CloseRule,
    readonly revealStrategy: RevealStrategy,
  ) {}

  static publish(draft: PublishableDraft, joinCode: string): PublishResult {
    const contestDraft = toContestDraft(draft.content);
    if (!contestDraft) {
      return { ok: false, error: { code: 'INCOMPLETE_DRAFT', message: refusal(draft.content) } };
    }

    const compiled = compile(contestDraft);
    if (!compiled.ok) {
      return { ok: false, error: { code: compiled.error.code, message: compiled.error.message } };
    }

    return {
      ok: true,
      contest: new Contest(
        draft.id,
        draft.hostId,
        draft.content.name,
        joinCode,
        compiled.contest,
        draft.content.closeRule ?? DEFAULT_CLOSE_RULE,
        draft.content.revealStrategy ?? DEFAULT_REVEAL_STRATEGY,
      ),
    };
  }
}

/** How publishing says each thing a draft can still be short of. */
const SAID_AS: Record<DraftGap, string> = {
  format: 'what kind of contest it is',
  participants: 'who is taking part',
  scoring: 'how it is scored',
};

/**
 * Why the draft was turned away, in the host's own terms.
 *
 * Three things are required and all three used to be reported as one sentence —
 * "The draft is missing its scoring rules" — whichever was actually absent. A
 * contest prepared entirely through the assistant arrives with its people and
 * its scoring settled and no format at all, and its host was told to go and fix
 * the scoring, which was already complete. A refusal that names the wrong thing
 * is worse than a vague one: it sends somebody to work on what is not broken.
 *
 * The judgement itself is `stillNeeded`, which anybody can ask before trying to
 * publish. This only puts words to what it answered.
 */
function refusal(content: DraftContent): string {
  const missing = stillNeeded(content).map((gap) => SAID_AS[gap]);

  // "a, b, or c" — the last one joined with "or", because any of them alone is
  // enough to stop a publish.
  const said =
    missing.length <= 1
      ? (missing[0] ?? 'what it needs')
      : `${missing.slice(0, -1).join(', ')}, or ${missing[missing.length - 1]}`;
  return `This contest cannot be published yet — it does not say ${said}.`;
}

/** A draft is publishable only once it carries the full rule-space configuration. */
function toContestDraft(content: DraftContent): ContestDraft | null {
  if (!content.format || !content.scoring || !content.participants) return null;
  return {
    format: content.format,
    scoring: content.scoring,
    participants: content.participants,
  };
}
