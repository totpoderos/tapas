import type { Attribution } from '@tapas/domain';
import type { StoredContest } from './stored-contest.js';

/** How far along a contest's voting is: who has joined, and who has sent. */
export interface ContestProgress {
  /** How many people have claimed a place. */
  readonly claimedCount: number;
  /** How many are still scoring — they have started a vote but not sent it. */
  readonly draftCount: number;
  /** How many have sent their vote. */
  readonly sentCount: number;
}

/**
 * A one-line view of something a host owns, for the contest list. It spans both
 * a draft still being prepared and a published contest at any point in its life,
 * so `status` adds `'draft'` to the stored-contest states.
 *
 * Everything past `updatedAt` is optional, and absent means **not applicable
 * yet** rather than zero. That distinction is the point of the read: a contest
 * still being prepared has no join code and no votes, and "voting has not
 * started" must not be readable as "nobody has voted". A host skimming the list
 * would otherwise have to tell those apart by guessing.
 */
export interface ContestSummary {
  readonly id: string;
  readonly name: string;
  readonly status: 'draft' | StoredContest['status'];
  /** When the item last changed, so the list can order by real activity. */
  readonly updatedAt: string;
  /** What a dish is credited to. Absent when the contest does not say. */
  readonly attribution?: Attribution;
  /** How many things each dish is judged on. Absent when none have been chosen. */
  readonly categoryCount?: number;
  /** The code people join with. Absent until the contest is published. */
  readonly joinCode?: string;
  /** How the voting is going. Absent until the contest is published. */
  readonly progress?: ContestProgress;
}
