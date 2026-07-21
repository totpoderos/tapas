import type { CloseContestDeps, CloseContestResult } from './shared.js';

/**
 * Host-triggered close: freezes the contest for good. No ownership check
 * here — matches {@link GetContest}, where ownership is enforced only at the
 * HTTP route (unlike draft use cases, which check it internally).
 */
export class CloseContest {
  constructor(private readonly deps: CloseContestDeps) {}

  execute(contestId: string): CloseContestResult {
    const contest = this.deps.contests.findById(contestId);
    if (!contest)
      return { ok: false, error: { code: 'CONTEST_NOT_FOUND', message: 'No such contest.' } };
    if (contest.status !== 'live') {
      return {
        ok: false,
        error: { code: 'ALREADY_CLOSED', message: 'This contest is already closed.' },
      };
    }

    const closedAt = this.deps.clock.now();
    this.deps.contests.updateStatus(contestId, 'closed', closedAt, null);
    return { ok: true, contest: { ...contest, status: 'closed', closedAt } };
  }
}
