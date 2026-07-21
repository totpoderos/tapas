import type { CloseRule, MaterializedContest, RevealStrategy } from '@tapas/domain';

/** A persisted contest. Its id is the id of the draft it was published from. */
export interface StoredContest {
  readonly id: string;
  readonly hostId: string;
  readonly name: string;
  readonly joinCode: string;
  readonly status: 'live' | 'closed' | 'revealed';
  readonly materialized: MaterializedContest;
  readonly closeRule: CloseRule;
  readonly revealStrategy: RevealStrategy;
  readonly createdAt: string;
  readonly closedAt: string | null;
  readonly revealedAt: string | null;
}
