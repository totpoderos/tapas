import type {
  CloseRule,
  ContestFormat,
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
   * What kind of contest this is, kept from the draft it was published from. The
   * compiled view records the consequence of the format (who may score what)
   * rather than the format itself, and that is lossy: where nobody has a partner,
   * `solo` and `solo_with_partners` compile to exactly the same thing. The draft
   * is retired at publish, so if the contest does not carry it, nothing does.
   * Absent reads as "does not say" rather than as any particular format.
   */
  readonly format?: ContestFormat;
  readonly closeRule: CloseRule;
  readonly revealStrategy: RevealStrategy;
  readonly createdAt: string;
  readonly closedAt: string | null;
  readonly revealedAt: string | null;
}
