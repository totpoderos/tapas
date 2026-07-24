import type { RevealContestDeps, RevealContestResult, StatusChangeContext } from './shared.js';

/**
 * Host-triggered reveal: a closed contest's winners become visible. No
 * ownership check here — matches {@link CloseContest} and {@link GetContest},
 * where ownership is enforced at the HTTP route. The reveal is recorded in the
 * audit log, carrying whether the host confirmed it.
 */
export class RevealContest {
  constructor(private readonly deps: RevealContestDeps) {}

  execute(contestId: string, context: StatusChangeContext): RevealContestResult {
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
    this.deps.audit.record(
      {
        type: 'contest.revealed',
        contestId,
        actorId: context.actorId,
        before: { status: 'closed' },
        after: { status: 'revealed' },
      },
      { sourcePath: 'form', confirmation: context.confirmation },
    );
    return { ok: true, contest: { ...contest, status: 'revealed', revealedAt } };
  }
}
