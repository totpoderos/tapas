import type { DraftContent } from '@tapas/domain';
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
  /**
   * Who is paired with whom, each pair named once. Absent when the contest keeps
   * nobody apart, and for a published contest, where the pairings have already
   * been compiled into who may not score whom.
   *
   * Carried because a host who asks to pair two people has to be able to see
   * that it happened. Without it, pairing Ana with Bob answers with exactly the
   * details it would have answered with before, and the change is invisible to
   * the one person who asked for it.
   */
  readonly pairs?: readonly (readonly [string, string])[];
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

/**
 * A draft's details, built the one way.
 *
 * Four use cases each had their own copy of this — the participant edits, the
 * scoring edits, the format-and-partner edits, and the details read — which is
 * four places for a field to be forgotten. `pairs` is exactly the field that
 * would have been: it was added for one of them and needed by all.
 */
export function draftDetailsOf(id: string, content: DraftContent): ContestDetails {
  const people = content.participants ?? [];
  const nameOf = (personId: string) => people.find((p) => p.id === personId)?.displayName;

  /*
   * Each pair named once. A partnership is reciprocal, so walking the people
   * would otherwise report Ana & Bob and then Bob & Ana — and a host reading
   * their own contest back should not have to work out that those are one
   * couple.
   */
  const seen = new Set<string>();
  const pairs: (readonly [string, string])[] = [];
  for (const person of people) {
    if (!person.partnerId || seen.has(person.id)) continue;
    const partnerName = nameOf(person.partnerId);
    // A partner who is not taking part is a half-formed pairing, which publishing
    // refuses; it is not a pair to show, and saying so is not this view's job.
    if (partnerName === undefined) continue;
    seen.add(person.id);
    seen.add(person.partnerId);
    pairs.push([person.displayName, partnerName]);
  }

  return {
    id,
    name: content.name,
    status: 'draft',
    participants: people.map((p) => p.displayName),
    categories: (content.scoring?.categories ?? []).map((c) => c.name),
    ...(pairs.length > 0 ? { pairs } : {}),
  };
}
