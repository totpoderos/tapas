import type { MaterializedContest } from '@tapas/domain';

/** A persisted live contest. Its id is the id of the draft it was published from. */
export interface StoredContest {
  readonly id: string;
  readonly hostId: string;
  readonly name: string;
  readonly joinCode: string;
  readonly status: 'live';
  readonly materialized: MaterializedContest;
  readonly createdAt: string;
}
