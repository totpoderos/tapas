import type { Category, DraftContent, ScoreRange, ScoringConfig } from '@tapas/domain';
import type { IdGenerator } from '../../audit/audit-projection.js';
import { draftDetailsOf, type ContestDetailsResult } from '../../contests/contest-details.js';
import type { ResolveContestByName } from '../../contests/use-cases/resolve-contest-by-name.js';
import type { DraftRepository } from '../../db/draft-repository.js';
import type { UpdateDraft } from './update-draft.js';

export interface ShapeDraftScoringDeps {
  readonly resolveContestByName: ResolveContestByName;
  readonly drafts: DraftRepository;
  readonly updateDraft: UpdateDraft;
  readonly ids: IdGenerator;
}

export type ScoringFailureCode = 'ALREADY_JUDGED_ON' | 'NOT_JUDGED_ON';

export interface ScoringFailure {
  readonly code: ScoringFailureCode;
  readonly message: string;
}

/**
 * The answer to a scoring change. Three outcomes, kept apart: the draft as it
 * now stands, the candidates when the name is not one draft, and a refusal
 * carrying a reason the host can act on.
 */
export type ScoringChangeResult =
  | { readonly ok: true; readonly result: ContestDetailsResult }
  | { readonly ok: false; readonly error: ScoringFailure };

/** What a draft with no scoring settled yet starts from, so one asking can be the first. */
const EMPTY_SCORING: ScoringConfig = {
  categories: [],
  range: { type: 'auto' },
  uniquePerCategory: false,
};

/**
 * Resolves a contest name to one of the host's *drafts* and loads it. Scoring is
 * settled while a contest is being prepared; once it is published the rules are
 * fixed, which is what `only: 'draft'` says. The name rule itself belongs to
 * {@link ResolveContestByName}, so a shared name behaves here exactly as it does
 * everywhere else.
 */
async function resolveDraft(
  deps: ShapeDraftScoringDeps,
  hostId: string,
  contestName: string,
): Promise<{ readonly id: string; readonly content: DraftContent } | ContestDetailsResult> {
  const resolved = await deps.resolveContestByName.execute(hostId, contestName, { only: 'draft' });
  if (resolved.kind !== 'one') {
    return { candidates: resolved.kind === 'several' ? resolved.candidates : [] };
  }
  const only = await deps.drafts.findById(resolved.contest.id);
  if (!only) return { candidates: [] };
  return { id: only.id, content: only.content };
}

/**
 * Applies one change to a draft's scoring and saves it.
 *
 * Every operation here goes through this, so "changing one rule leaves the
 * others alone" holds by construction rather than by each caller remembering to
 * spread what it did not touch. A draft with no scoring yet gets a blank one to
 * change, so the first asking does not have to be a different asking.
 */
async function changeScoring(
  deps: ShapeDraftScoringDeps,
  hostId: string,
  contestName: string,
  change: (scoring: ScoringConfig) => ScoringConfig | ScoringFailure,
): Promise<ScoringChangeResult> {
  const resolved = await resolveDraft(deps, hostId, contestName);
  if (!('content' in resolved)) return { ok: true, result: resolved };

  const changed = change(resolved.content.scoring ?? EMPTY_SCORING);
  if ('code' in changed) return { ok: false, error: changed };

  const content: DraftContent = { ...resolved.content, scoring: changed };
  const saved = await deps.updateDraft.execute(resolved.id, hostId, content);
  return { ok: true, result: { details: draftDetailsOf(resolved.id, saved.ok ? content : resolved.content) } };
}

/** Matching a category the way a host says it: by name, ignoring case and stray spaces. */
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Adds something for a draft to be judged on.
 *
 * A name the draft already carries is refused rather than added twice. Not
 * fussiness: the assistant addresses a category by its name, exactly as it
 * addresses a contest, so two categories called "Taste" would leave the host
 * with no way to say which one to remove. The form can allow duplicates because
 * it removes by the row it drew; a conversation has only the name.
 */
export class AddScoringCategory {
  constructor(private readonly deps: ShapeDraftScoringDeps) {}

  async execute(hostId: string, contestName: string, categoryName: string): Promise<ScoringChangeResult> {
    const wanted = categoryName.trim();
    return await changeScoring(this.deps, hostId, contestName, (scoring) => {
      if (scoring.categories.some((c) => sameName(c.name, wanted))) {
        return {
          code: 'ALREADY_JUDGED_ON',
          message: `This contest is already judged on "${wanted}".`,
        };
      }
      const category: Category = { id: this.deps.ids.next(), name: wanted };
      return { ...scoring, categories: [...scoring.categories, category] };
    });
  }
}

/**
 * Stops a draft being judged on something. Destructive — it takes away a
 * category the host named and any thought that went into it — so the assistant
 * confirms first, exactly as it does for removing a person.
 *
 * Asking to remove something the draft is not judged on is refused with a
 * reason rather than quietly reported as done: the host has just confirmed a
 * removal, and "done" over an unchanged draft is the worst of both answers.
 */
export class RemoveScoringCategory {
  constructor(private readonly deps: ShapeDraftScoringDeps) {}

  async execute(hostId: string, contestName: string, categoryName: string): Promise<ScoringChangeResult> {
    const wanted = categoryName.trim();
    return await changeScoring(this.deps, hostId, contestName, (scoring) => {
      const remaining = scoring.categories.filter((c) => !sameName(c.name, wanted));
      if (remaining.length === scoring.categories.length) {
        return {
          code: 'NOT_JUDGED_ON',
          message: `This contest is not judged on "${wanted}".`,
        };
      }
      return { ...scoring, categories: remaining };
    });
  }
}

/**
 * Sets the range scores are given within: an explicit min..max, or worked out
 * from the contest itself (1..however many dishes that judge may score).
 *
 * A min..max that makes no range is stored rather than refused. It is two
 * perfectly good numbers in the right shape, and what is wrong with it only
 * shows against the whole contest — which is what publishing checks, for the
 * form and for the assistant alike. Refusing it here would be a second
 * validator that the form does not share.
 */
export class SetScoreRange {
  constructor(private readonly deps: ShapeDraftScoringDeps) {}

  async execute(hostId: string, contestName: string, range: ScoreRange): Promise<ScoringChangeResult> {
    return await changeScoring(this.deps, hostId, contestName, (scoring) => ({ ...scoring, range }));
  }
}

/** Settles whether a score may be used more than once within one category. */
export class SetScoreUniqueness {
  constructor(private readonly deps: ShapeDraftScoringDeps) {}

  async execute(hostId: string, contestName: string, uniquePerCategory: boolean): Promise<ScoringChangeResult> {
    return await changeScoring(this.deps, hostId, contestName, (scoring) => ({ ...scoring, uniquePerCategory }));
  }
}
