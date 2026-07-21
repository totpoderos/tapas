import type { GetTallyDeps, GetTallyResult } from './shared.js';

/**
 * A live progress view for a contest still in play — how many participants
 * have claimed a place and how many have drafted or sent their vote. Not the
 * results themselves: no scores, no winners, available before reveal.
 */
export class GetTally {
  constructor(private readonly deps: GetTallyDeps) {}

  execute(contestId: string): GetTallyResult {
    const contest = this.deps.contests.findById(contestId);
    if (!contest)
      return { ok: false, error: { code: 'CONTEST_NOT_FOUND', message: 'No such contest.' } };

    const claimedCount = this.deps.roster.listClaimed(contestId).length;
    const sessions = this.deps.voteSessions.listSessions(contestId);
    const draftCount = sessions.filter((session) => session.status === 'draft').length;
    const sentCount = sessions.filter((session) => session.status === 'sent').length;

    return { ok: true, tally: { claimedCount, draftCount, sentCount } };
  }
}
