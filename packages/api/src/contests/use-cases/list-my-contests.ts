import type { ContestRepository } from '../../db/contest-repository.js';
import type { DraftRepository } from '../../db/draft-repository.js';
import type { RosterRepository } from '../../db/roster-repository.js';
import type { VoteSessionRepository } from '../../db/vote-session-repository.js';
import type { StoredDraft } from '../../drafts/stored-draft.js';
import type { ContestProgress, ContestSummary } from '../contest-summary.js';
import type { StoredContest } from '../stored-contest.js';

export interface ListMyContestsDeps {
  readonly drafts: DraftRepository;
  readonly contests: ContestRepository;
  readonly roster: RosterRepository;
  readonly voteSessions: VoteSessionRepository;
}

/**
 * Lists everything a host owns for their contest list — the drafts they are
 * still preparing and the contests they have published (live, closed, or
 * revealed) — as one set of one-line summaries, most recently touched first.
 * A read-only query: it never changes anything, and only ever the host's own.
 *
 * Each summary carries enough to read the contest without opening it: what it
 * judges dishes on, the code people join with, and how far along its voting is.
 * The two counts that are not on the contest row are fetched for the whole list
 * in one query each, not per contest — a host with a dozen contests should not
 * cost two dozen extra round trips to draw one table.
 */
export class ListMyContests {
  constructor(private readonly deps: ListMyContestsDeps) {}

  execute(hostId: string): ContestSummary[] {
    const drafts = this.deps.drafts.findByHost(hostId);
    const published = this.deps.contests.findByHost(hostId);

    const ids = published.map((contest) => contest.id);
    const claimed = this.deps.roster.countClaimedByContest(ids);
    const sessions = this.deps.voteSessions.countSessionsByContest(ids);

    const fromDrafts = drafts.map(draftSummary);
    const fromContests = published.map((contest) =>
      contestSummary(contest, {
        // A contest nobody has joined is absent from both maps, which is a real
        // zero — it is published, so the counts apply; they are just all nought.
        claimedCount: claimed.get(contest.id) ?? 0,
        draftCount: sessions.get(contest.id)?.draftCount ?? 0,
        sentCount: sessions.get(contest.id)?.sentCount ?? 0,
      }),
    );
    return [...fromDrafts, ...fromContests].sort(byMostRecentFirst);
  }
}

function draftSummary(draft: StoredDraft): ContestSummary {
  const categories = draft.content.scoring?.categories;
  return {
    id: draft.id,
    name: draft.content.name,
    status: 'draft',
    updatedAt: draft.updatedAt,
    // A draft carries whichever rules it has been given so far, and nothing for
    // the ones it has not. It has no join code and no progress at all: it is not
    // published, which is a different thing from nobody having voted.
    ...(draft.content.attribution === undefined
      ? {}
      : { attribution: draft.content.attribution }),
    ...(categories === undefined ? {} : { categoryCount: categories.length }),
  };
}

function contestSummary(contest: StoredContest, progress: ContestProgress): ContestSummary {
  return {
    id: contest.id,
    name: contest.name,
    status: contest.status,
    // The last thing that happened to it, so ordering reflects real activity.
    updatedAt: contest.revealedAt ?? contest.closedAt ?? contest.createdAt,
    ...(contest.attribution === undefined ? {} : { attribution: contest.attribution }),
    categoryCount: contest.materialized.categories.length,
    joinCode: contest.joinCode,
    progress,
  };
}

// Newest activity first; id breaks ties so the order is always deterministic.
function byMostRecentFirst(a: ContestSummary, b: ContestSummary): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
  return a.id < b.id ? -1 : 1;
}
