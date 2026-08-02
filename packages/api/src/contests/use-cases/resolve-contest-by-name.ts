import type { ContestSummary } from '../contest-summary.js';
import type { FindContestsByName } from './find-contests-by-name.js';

/** Narrows what a name may resolve to. `'draft'` is for the edits only a draft accepts. */
export interface ResolveContestOptions {
  readonly only?: 'draft';
}

/**
 * What a name resolved to. Three cases, kept apart on purpose: acting on one
 * contest, asking the host which of several they meant, and finding none. A
 * caller that cannot see the difference between the last two would report a
 * mistyped name as a refused action, or worse, treat "several" as "the first
 * one".
 */
export type ResolvedContest =
  | { readonly kind: 'one'; readonly contest: ContestSummary }
  | { readonly kind: 'several'; readonly candidates: readonly ContestSummary[] }
  | { readonly kind: 'none' };

/**
 * Resolves the name a host said to exactly one of their own contests — the one
 * way the whole host-facing surface addresses a contest (design.md §6.1). A host
 * refers to a contest by its name; an internal id is not something they see on
 * screen, say aloud, or should have to hold on to.
 *
 * The rule is written once here so it cannot come to differ between operations:
 * matching is exact but case-insensitive (a partial name never resolves, so an
 * action cannot land on the wrong contest), only the host's own contests are
 * searched, and a name several contests bear resolves to *several* rather than
 * to whichever came back first.
 *
 * That last point is why this returns before anything is changed. A shared name
 * must be settled with the host first; a destructive action confirmed against an
 * unresolved name would be confirmed against nothing in particular.
 *
 * Because only the host's own contests are searched, another host's contest is
 * not refused — it is simply not there. A refusal would confirm that a contest
 * by that name exists, which is exactly what a host of a *different* contest
 * should not be able to learn.
 */
export class ResolveContestByName {
  constructor(private readonly findContestsByName: FindContestsByName) {}

  execute(hostId: string, name: string, options: ResolveContestOptions = {}): ResolvedContest {
    const found = this.findContestsByName.execute(hostId, name);
    /*
     * A draft-only action ignores a published contest bearing the same name
     * rather than counting it as a rival candidate: a host who re-runs "Tapas
     * Night" every spring would otherwise be unable to edit this year's draft
     * while last year's contest still exists.
     */
    const matches = options.only === 'draft' ? found.filter((c) => c.status === 'draft') : found;

    const [only] = matches;
    if (matches.length === 1 && only) return { kind: 'one', contest: only };
    if (matches.length === 0) return { kind: 'none' };
    return { kind: 'several', candidates: matches };
  }
}
