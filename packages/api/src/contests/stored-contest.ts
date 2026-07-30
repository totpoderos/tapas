import type {
  AntiBias,
  Attribution,
  CloseRule,
  MaterializedContest,
  RevealStrategy,
} from '@tapas/domain';

/** A persisted contest. Its id is the id of the draft it was published from. */
export interface StoredContest {
  readonly id: string;
  readonly hostId: string;
  readonly name: string;
  readonly joinCode: string;
  readonly status: 'live' | 'closed' | 'revealed';
  readonly materialized: MaterializedContest;
  /**
   * What the contest credits a dish to, kept from the draft it was published
   * from. The compiled view records the consequence of this rule (a dish has one
   * submitter or two) rather than the rule, so it is carried separately for the
   * host's own reading. Absent on a contest published before it was kept.
   */
  readonly attribution?: Attribution;
  /**
   * Which same-side scoring the contest bars, kept from the draft for the same
   * reason as `attribution` — and more urgently. The compiler folds this rule into
   * `allowedVoters`, which is lossy: a contest barring couples and one barring
   * chosen pairs compile to the same shape. Absent on a contest published before
   * it was kept, which reads as "does not say" rather than "no restriction".
   */
  readonly antiBias?: AntiBias;
  readonly closeRule: CloseRule;
  readonly revealStrategy: RevealStrategy;
  readonly createdAt: string;
  readonly closedAt: string | null;
  readonly revealedAt: string | null;
}
