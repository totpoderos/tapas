import { shouldAutoClose } from '@tapas/domain';
import type { Clock } from '../audit/audit-projection.js';
import type { ContestRepository } from '../db/contest-repository.js';
import type { StoredContest } from './stored-contest.js';

export interface EnsureContestFreshDeps {
  readonly contests: ContestRepository;
  readonly clock: Clock;
}

/**
 * Applies a due `scheduled` auto-close to an already-loaded contest. Cheap by
 * design — only `contests`+`clock` — so any route holding a contest can call
 * it before acting on it. `all_sent` auto-close happens eagerly right after
 * `SendVote` instead, since that is the only event that can make it true.
 */
export function ensureContestFresh(
  contest: StoredContest,
  deps: EnsureContestFreshDeps,
): StoredContest {
  if (contest.status !== 'live' || contest.closeRule.when !== 'scheduled') return contest;

  const now = deps.clock.now();
  if (!shouldAutoClose(contest.closeRule, { allClaimedSent: false }, now)) return contest;

  deps.contests.updateStatus(contest.id, 'closed', now, null);
  return { ...contest, status: 'closed', closedAt: now };
}
