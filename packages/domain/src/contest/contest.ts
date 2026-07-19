import { compile, type CompileErrorCode } from '../compile.js';
import type { DraftContent } from '../draft/draft-content.js';
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

/**
 * A live contest, produced by publishing a draft. Publishing assembles the
 * draft's configuration into a compiler input, compiles it (fixing the scoring
 * rules), and pairs the result with a join code. The join code is generated
 * outside the domain and passed in.
 */
export class Contest {
  readonly status = 'live' as const;

  private constructor(
    readonly id: string,
    readonly hostId: string,
    readonly name: string,
    readonly joinCode: string,
    readonly materialized: MaterializedContest,
  ) {}

  static publish(draft: PublishableDraft, joinCode: string): PublishResult {
    const contestDraft = toContestDraft(draft.content);
    if (!contestDraft) {
      return { ok: false, error: { code: 'INCOMPLETE_DRAFT', message: 'The draft is missing its scoring rules.' } };
    }

    const compiled = compile(contestDraft);
    if (!compiled.ok) {
      return { ok: false, error: { code: compiled.error.code, message: compiled.error.message } };
    }

    return {
      ok: true,
      contest: new Contest(draft.id, draft.hostId, draft.content.name, joinCode, compiled.contest),
    };
  }
}

/** A draft is publishable only once it carries the full rule-space configuration. */
function toContestDraft(content: DraftContent): ContestDraft | null {
  if (!content.attribution || !content.antiBias || !content.scoring || !content.participants) return null;
  return {
    attribution: content.attribution,
    antiBias: content.antiBias,
    scoring: content.scoring,
    participants: content.participants,
  };
}
