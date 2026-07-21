import { shouldAutoClose } from '@tapas/domain';
import type { Clock } from '../audit/audit-projection.js';
import type { ContestRepository } from '../db/contest-repository.js';
import type { StoredContest } from './stored-contest.js';

export interface EnsureContestFreshDeps {
  readonly contests: ContestRepository;
  readonly clock: Clock;
}

/**
 * Applies a due `scheduled` auto-close and/or auto-reveal to an
 * already-loaded contest. Cheap by design — only `contests`+`clock` — so any
 * route holding a contest can call it before acting on it. `all_sent`
 * auto-close happens eagerly right after `SendVote` instead, since that is
 * the only event that can make it true.
 */
export function ensureContestFresh(
  contest: StoredContest,
  deps: EnsureContestFreshDeps,
): StoredContest {
  let current = contest;

  if (current.status === 'live' && current.closeRule.when === 'scheduled') {
    const now = deps.clock.now();
    if (shouldAutoClose(current.closeRule, { allClaimedSent: false }, now)) {
      deps.contests.updateStatus(current.id, 'closed', now, null);
      current = { ...current, status: 'closed', closedAt: now };
    }
  }

  if (current.status === 'closed' && current.revealStrategy.when === 'scheduled') {
    const now = deps.clock.now();
    if (Date.parse(now) >= Date.parse(current.revealStrategy.at)) {
      deps.contests.updateStatus(current.id, 'revealed', current.closedAt, now);
      current = { ...current, status: 'revealed', revealedAt: now };
    }
  }

  return current;
}
