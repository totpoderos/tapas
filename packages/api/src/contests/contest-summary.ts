import type { StoredContest } from './stored-contest.js';

/**
 * A one-line view of something a host owns, for the contest list. It spans both
 * a draft still being prepared and a published contest at any point in its life,
 * so `status` adds `'draft'` to the stored-contest states.
 */
export interface ContestSummary {
  readonly id: string;
  readonly name: string;
  readonly status: 'draft' | StoredContest['status'];
  /** When the item last changed, so the list can order by real activity. */
  readonly updatedAt: string;
}
