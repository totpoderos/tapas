import type { ContestRepository } from '../../db/contest-repository.js';
import type { DraftRepository } from '../../db/draft-repository.js';
import type { RosterRepository } from '../../db/roster-repository.js';
import type { ContestDetails, ContestDetailsResult } from '../contest-details.js';
import type { FindContestsByName } from './find-contests-by-name.js';

export interface GetContestDetailsDeps {
  readonly findContestsByName: FindContestsByName;
  readonly drafts: DraftRepository;
  readonly contests: ContestRepository;
  readonly roster: RosterRepository;
}

/**
 * Reads what is inside one of a host's contests, found by name (design.md §6.1).
 * Resolution is delegated to {@link FindContestsByName} (host-scoped, exact but
 * case-insensitive), so this shares one notion of ownership and matching with the
 * other by-name tools. A name is not unique — a host may reuse "Tapas Night" — so
 * a shared name returns the candidates for the host to choose from rather than
 * guessing; a name that matches nothing returns no candidates.
 *
 * The details read the same whether the contest is a draft or published, even
 * though the two store participants differently: a draft carries its participants
 * inline, while a published contest keeps them in its roster.
 */
export class GetContestDetails {
  constructor(private readonly deps: GetContestDetailsDeps) {}

  execute(hostId: string, name: string): ContestDetailsResult {
    const matches = this.deps.findContestsByName.execute(hostId, name);
    const [only] = matches;
    if (matches.length !== 1 || !only) return { candidates: matches };

    return { details: only.status === 'draft' ? this.draftDetails(only.id) : this.contestDetails(only.id) };
  }

  private draftDetails(id: string): ContestDetails {
    const draft = this.deps.drafts.findById(id);
    const content = draft?.content;
    return {
      id,
      name: content?.name ?? '',
      status: 'draft',
      participants: (content?.participants ?? []).map((person) => person.displayName),
      categories: (content?.scoring?.categories ?? []).map((category) => category.name),
    };
  }

  private contestDetails(id: string): ContestDetails {
    const contest = this.deps.contests.findById(id);
    return {
      id,
      name: contest?.name ?? '',
      status: contest?.status ?? 'live',
      participants: this.deps.roster.listAll(id).map((place) => place.displayName),
      categories: (contest?.materialized.categories ?? []).map((category) => category.name),
    };
  }
}
