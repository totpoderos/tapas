import { checkScore, type ScoreInput } from '@tapas/domain';
import type { Clock, IdGenerator } from '../../audit/audit-projection.js';
import type { ContestRepository } from '../../db/contest-repository.js';
import type { VoteSessionRepository } from '../../db/vote-session-repository.js';
import type { SaveScoreResult } from './shared.js';

export interface SaveScoreDeps {
  readonly contests: ContestRepository;
  readonly voteSessions: VoteSessionRepository;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/**
 * Saves (or revises) a draft score, checked against the compiled constraint
 * view. A voter's vote session is created implicitly on their first score —
 * there is no separate "start" step to call first.
 */
export class SaveScore {
  constructor(private readonly deps: SaveScoreDeps) {}

  execute(contestId: string, voterId: string, input: ScoreInput): SaveScoreResult {
    const contest = this.deps.contests.findById(contestId);
    if (!contest)
      return { ok: false, error: { code: 'CONTEST_NOT_FOUND', message: 'No such contest.' } };

    const checked = checkScore(contest.materialized, voterId, input);
    if (!checked.ok) return { ok: false, error: checked.error };

    let session = this.deps.voteSessions.findSession(contestId, voterId);
    if (session?.status === 'sent') {
      return {
        ok: false,
        error: { code: 'SESSION_LOCKED', message: 'This vote has already been sent.' },
      };
    }
    if (!session) {
      session = {
        id: this.deps.ids.next(),
        contestId,
        voterId,
        status: 'draft',
        createdAt: this.deps.clock.now(),
        submittedAt: null,
      };
      this.deps.voteSessions.createSession(session);
    }

    // Reuse the existing row's id on a revision — the upsert's ON CONFLICT
    // keeps the original id regardless, so a freshly generated one here would
    // silently mismatch what is actually persisted.
    const existing = this.deps.voteSessions.findScore(session.id, input.dishId, input.categoryId);
    const score = {
      id: existing?.id ?? this.deps.ids.next(),
      voteSessionId: session.id,
      dishId: input.dishId,
      categoryId: input.categoryId,
      value: input.value,
    };
    this.deps.voteSessions.upsertScore(score);
    return { ok: true, score };
  }
}
