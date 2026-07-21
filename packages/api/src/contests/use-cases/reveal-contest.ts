import type { RevealContestDeps, RevealContestResult } from './shared.js';

/**
 * Host-triggered reveal: a closed contest's winners become visible. No
 * ownership check here — matches {@link CloseContest} and {@link GetContest},
 * where ownership is enforced at the HTTP route.
 */
export class RevealContest {
  constructor(private readonly deps: RevealContestDeps) {}

  execute(contestId: string): RevealContestResult {
    const contest = this.deps.contests.findById(contestId);
    if (!contest)
      return { ok: false, error: { code: 'CONTEST_NOT_FOUND', message: 'No such contest.' } };
    if (contest.status === 'live') {
      return {
        ok: false,
        error: { code: 'NOT_CLOSED', message: 'This contest has not closed yet.' },
      };
    }
    if (contest.status === 'revealed') {
      return {
        ok: false,
        error: { code: 'ALREADY_REVEALED', message: 'This contest has already been revealed.' },
      };
    }

    const revealedAt = this.deps.clock.now();
    this.deps.contests.updateStatus(contestId, 'revealed', contest.closedAt, revealedAt);
    return { ok: true, contest: { ...contest, status: 'revealed', revealedAt } };
  }
}
