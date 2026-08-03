import type { ContestSummary } from '../contest-summary.js';
import type { ListMyContests } from './list-my-contests.js';

/**
 * Finds a host's own contests by name — the way a host refers to them out loud,
 * rather than by an internal id (design.md §6.1). Matching is **exact but
 * case-insensitive**: "tapas night" finds "Tapas Night", but a partial name does
 * not, so a name can never resolve to the wrong contest before a destructive
 * action. Because a name is not unique — a host may run "Tapas Night" more than
 * once — this returns *all* matches; the caller (or the host) disambiguates. A
 * name that matches nothing returns an empty list.
 *
 * This is deliberately "the host's contest list, filtered by name": it reuses
 * {@link ListMyContests} so the two share one notion of what a host owns and how
 * it is summarised, and the name resolution stays deterministic and server-side.
 */
export class FindContestsByName {
  constructor(private readonly listMyContests: ListMyContests) {}

  async execute(hostId: string, name: string): Promise<ContestSummary[]> {
    const wanted = name.trim().toLowerCase();
    if (wanted === '') return [];
    return (await this.listMyContests.execute(hostId)).filter((c) => c.name.toLowerCase() === wanted);
  }
}
