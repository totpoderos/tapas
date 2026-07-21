import { shouldAutoClose, VoteSession } from '@tapas/domain';
import type { Clock } from '../../audit/audit-projection.js';
import type { ContestRepository } from '../../db/contest-repository.js';
import type { RosterRepository } from '../../db/roster-repository.js';
import type { VoteSessionRepository } from '../../db/vote-session-repository.js';
import type { SendVoteResult } from './shared.js';

export interface SendVoteDeps {
  readonly contests: ContestRepository;
  readonly voteSessions: VoteSessionRepository;
  readonly roster: RosterRepository;
  readonly clock: Clock;
}

/**
 * Sends (locks) a voter's vote session, delegating the completeness and
 * ranking checks — and the "already sent" guard — to the domain
 * {@link VoteSession} aggregate.
 */
export class SendVote {
  constructor(private readonly deps: SendVoteDeps) {}

  execute(contestId: string, voterId: string): SendVoteResult {
    const contest = this.deps.contests.findById(contestId);
    if (!contest)
      return { ok: false, error: { code: 'CONTEST_NOT_FOUND', message: 'No such contest.' } };
    if (contest.status !== 'live')
      return { ok: false, error: { code: 'CONTEST_CLOSED', message: 'This contest is closed.' } };

    const stored = this.deps.voteSessions.findSession(contestId, voterId);
    if (!stored) {
      return {
        ok: false,
        error: { code: 'NO_VOTE_SESSION', message: 'You have not scored anything yet.' },
      };
    }

    const session = VoteSession.rehydrate(
      stored.id,
      stored.contestId,
      stored.voterId,
      stored.status,
      stored.createdAt,
      stored.submittedAt,
    );
    const scores = this.deps.voteSessions.listScores(stored.id);
    const now = this.deps.clock.now();

    const sent = session.send(contest.materialized, scores, now);
    if (!sent.ok) return { ok: false, error: sent.error };

    this.deps.voteSessions.markSent(stored.id, now);

    if (contest.closeRule.when === 'all_sent') {
      const claimed = this.deps.roster.listClaimed(contestId);
      const allClaimedSent = claimed.every(
        (place) => this.deps.voteSessions.findSession(contestId, place.participantId)?.status === 'sent',
      );
      if (shouldAutoClose(contest.closeRule, { allClaimedSent }, now)) {
        this.deps.contests.updateStatus(contestId, 'closed', now, null);
      }
    }

    return {
      ok: true,
      session: { ...stored, status: 'sent', submittedAt: now },
    };
  }
}
