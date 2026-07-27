import type { ContestSummary } from './contest-summary.js';

/**
 * What is inside one of a host's contests — who is taking part and how it is
 * scored — as a single view that reads the same whether the contest is still a
 * draft or already published (design.md §6.1). Names only: the host asked to see
 * the participants and categories, not internal ids.
 */
export interface ContestDetails {
  readonly id: string;
  readonly name: string;
  readonly status: ContestSummary['status'];
  readonly participants: readonly string[];
  readonly categories: readonly string[];
}

/**
 * The answer to "show me the details of the contest named X". Exactly one of:
 * `details` when the name resolves to a single contest; `candidates` when a name
 * is shared by more than one (the caller asks the host which), or is empty when
 * nothing matches.
 */
export interface ContestDetailsResult {
  readonly details?: ContestDetails;
  readonly candidates?: readonly ContestSummary[];
}
