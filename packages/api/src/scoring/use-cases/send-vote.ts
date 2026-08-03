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

  async execute(contestId: string, voterId: string): Promise<SendVoteResult> {
    const contest = await this.deps.contests.findById(contestId);
    if (!contest)
      return { ok: false, error: { code: 'CONTEST_NOT_FOUND', message: 'No such contest.' } };
    if (contest.status !== 'live')
      return { ok: false, error: { code: 'CONTEST_CLOSED', message: 'This contest is closed.' } };

    const stored = await this.deps.voteSessions.findSession(contestId, voterId);
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
    const scores = await this.deps.voteSessions.listScores(stored.id);
    const now = this.deps.clock.now();

    const sent = session.send(contest.materialized, scores, now);
    if (!sent.ok) return { ok: false, error: sent.error };

    await this.deps.voteSessions.markSent(stored.id, now);

    if (contest.closeRule.when === 'all_sent') {
      /*
       * Every place on the roster, not every place claimed so far. `listClaimed`
       * here meant the first participant to send closed the contest for the
       * whole room: at that moment they were often the only person who had
       * claimed, so "everyone who claimed has sent" was trivially true. A closed
       * contest refuses scores and dishes, so the rest of the evening was locked
       * out with their drafts stranded and closing has no undo.
       */
      const places = await this.deps.roster.listAll(contestId);
      const sessions = await Promise.all(
        places.map((place) => this.deps.voteSessions.findSession(contestId, place.participantId)),
      );
      const allPlacesSent = sessions.every((session) => session?.status === 'sent');
      if (shouldAutoClose(contest.closeRule, { allPlacesSent }, now)) {
        await this.deps.contests.updateStatus(contestId, 'closed', now, null);
      }
    }

    return {
      ok: true,
      session: { ...stored, status: 'sent', submittedAt: now },
    };
  }
}
