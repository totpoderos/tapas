import type { DraftContent, Person } from '@tapas/domain';
import type { IdGenerator } from '../../audit/audit-projection.js';
import { draftDetailsOf, type ContestDetailsResult } from '../../contests/contest-details.js';
import type { ResolveContestByName } from '../../contests/use-cases/resolve-contest-by-name.js';
import type { DraftRepository } from '../../db/draft-repository.js';
import type { UpdateDraft } from './update-draft.js';

export interface ManageDraftParticipantsDeps {
  readonly resolveContestByName: ResolveContestByName;
  readonly drafts: DraftRepository;
  readonly updateDraft: UpdateDraft;
  readonly ids: IdGenerator;
}

export type ParticipantFailureCode = 'NOBODY_BY_THAT_NAME' | 'SEVERAL_BY_THAT_NAME';

export interface ParticipantFailure {
  readonly code: ParticipantFailureCode;
  readonly message: string;
}

/**
 * The answer to removing somebody. Three outcomes: the draft as it now stands,
 * the candidates when the contest name is not one draft, and a refusal carrying
 * a reason — the same three `RemoveScoringCategory` gives, because they are the
 * same action on different things.
 */
export type RemoveParticipantResult =
  | { readonly ok: true; readonly result: ContestDetailsResult }
  | { readonly ok: false; readonly error: ParticipantFailure };

/**
 * Resolves a contest name to exactly one of the host's *drafts*, then loads it.
 * Participant management is for drafts only: once a contest is published its
 * participants are settled (the roster is seeded at publish), which is what
 * `only: 'draft'` says.
 *
 * The name rule itself is not written here — {@link ResolveContestByName} owns
 * it, so a shared name, a name only another host has, and a name nobody has all
 * behave the same way here as they do for every other operation.
 */
async function resolveDraft(
  deps: ManageDraftParticipantsDeps,
  hostId: string,
  contestName: string,
): Promise<{ readonly id: string; readonly content: DraftContent } | ContestDetailsResult> {
  const resolved = await deps.resolveContestByName.execute(hostId, contestName, { only: 'draft' });
  if (resolved.kind === 'none') return { candidates: [] };
  if (resolved.kind === 'several') return { candidates: resolved.candidates };
  const only = await deps.drafts.findById(resolved.contest.id);
  if (!only) return { candidates: [] };
  return { id: only.id, content: only.content };
}

/** Adds a participant to one of the host's drafts, found by name. Reversible — not destructive. */
export class AddDraftParticipant {
  constructor(private readonly deps: ManageDraftParticipantsDeps) {}

  async execute(hostId: string, contestName: string, displayName: string): Promise<ContestDetailsResult> {
    const resolved = await resolveDraft(this.deps, hostId, contestName);
    if (!('content' in resolved)) return resolved;

    const person: Person = { id: this.deps.ids.next(), displayName: displayName.trim() };
    const content: DraftContent = {
      ...resolved.content,
      participants: [...(resolved.content.participants ?? []), person],
    };
    const saved = await this.deps.updateDraft.execute(resolved.id, hostId, content);
    return { details: draftDetailsOf(resolved.id, saved.ok ? content : resolved.content) };
  }
}

/**
 * Removes a participant (matched by name, case-insensitively) from one of the
 * host's drafts. Removing someone also clears any pairing that named them — their
 * partner is unpaired, and any "may not score" reference to them is dropped — so
 * the draft never holds a dangling reference. Destructive: the assistant confirms
 * with the host first (design.md §6.1).
 */
export class RemoveDraftParticipant {
  constructor(private readonly deps: ManageDraftParticipantsDeps) {}

  async execute(hostId: string, contestName: string, displayName: string): Promise<RemoveParticipantResult> {
    const resolved = await resolveDraft(this.deps, hostId, contestName);
    if (!('content' in resolved)) return { ok: true, result: resolved };

    const wanted = displayName.trim().toLowerCase();
    const existing = resolved.content.participants ?? [];
    const matches = existing.filter((p) => p.displayName.trim().toLowerCase() === wanted);

    /*
     * Nobody by that name is refused rather than reported as done. The host has
     * just confirmed a removal, and answering with an unchanged draft reads as
     * "removed" — the worst answer available.
     */
    if (matches.length === 0) {
      return {
        ok: false,
        error: {
          code: 'NOBODY_BY_THAT_NAME',
          message: `Nobody called "${displayName.trim()}" is taking part.`,
        },
      };
    }

    /*
     * A name two people share used to remove BOTH of them. A destructive action
     * taking away more than the host named is the one thing confirming exists to
     * prevent — and the confirmation they gave named one person, not two. A
     * display name is how the assistant reaches somebody, so a name that reaches
     * two goes back to the host, exactly as `set_partner` does with one.
     */
    if (matches.length > 1) {
      return {
        ok: false,
        error: {
          code: 'SEVERAL_BY_THAT_NAME',
          message: `More than one person taking part is called "${displayName.trim()}" — which one do you mean?`,
        },
      };
    }

    const removedIds = new Set(matches.map((p) => p.id));
    const participants: Person[] = existing
      .filter((p) => !removedIds.has(p.id))
      // Removing somebody clears the partnership that named them, so a draft
      // never holds a dangling reference. A partner is the only such reference
      // left, so it is the only one to clear.
      .map((p) => ({
        ...p,
        ...(p.partnerId && removedIds.has(p.partnerId) ? { partnerId: undefined } : {}),
      }));
    const content: DraftContent = { ...resolved.content, participants };
    const saved = await this.deps.updateDraft.execute(resolved.id, hostId, content);
    return { ok: true, result: { details: draftDetailsOf(resolved.id, saved.ok ? content : resolved.content) } };
  }
}
