import type { ContestRepository } from '../../db/contest-repository.js';
import type { DraftRepository } from '../../db/draft-repository.js';
import type { StoredDraft } from '../../drafts/stored-draft.js';
import type { ContestSummary } from '../contest-summary.js';
import type { StoredContest } from '../stored-contest.js';

export interface ListMyContestsDeps {
  readonly drafts: DraftRepository;
  readonly contests: ContestRepository;
}

/**
 * Lists everything a host owns for their contest list — the drafts they are
 * still preparing and the contests they have published (live, closed, or
 * revealed) — as one set of one-line summaries, most recently touched first.
 * A read-only query: it never changes anything, and only ever the host's own.
 */
export class ListMyContests {
  constructor(private readonly deps: ListMyContestsDeps) {}

  execute(hostId: string): ContestSummary[] {
    const fromDrafts = this.deps.drafts.findByHost(hostId).map(draftSummary);
    const fromContests = this.deps.contests.findByHost(hostId).map(contestSummary);
    return [...fromDrafts, ...fromContests].sort(byMostRecentFirst);
  }
}

function draftSummary(draft: StoredDraft): ContestSummary {
  return { id: draft.id, name: draft.content.name, status: 'draft', updatedAt: draft.updatedAt };
}

function contestSummary(contest: StoredContest): ContestSummary {
  return {
    id: contest.id,
    name: contest.name,
    status: contest.status,
    // The last thing that happened to it, so ordering reflects real activity.
    updatedAt: contest.revealedAt ?? contest.closedAt ?? contest.createdAt,
  };
}

// Newest activity first; id breaks ties so the order is always deterministic.
function byMostRecentFirst(a: ContestSummary, b: ContestSummary): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
  return a.id < b.id ? -1 : 1;
}
