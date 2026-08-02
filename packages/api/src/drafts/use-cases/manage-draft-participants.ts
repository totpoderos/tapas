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
function resolveDraft(
  deps: ManageDraftParticipantsDeps,
  hostId: string,
  contestName: string,
): { readonly id: string; readonly content: DraftContent } | ContestDetailsResult {
  const resolved = deps.resolveContestByName.execute(hostId, contestName, { only: 'draft' });
  if (resolved.kind === 'none') return { candidates: [] };
  if (resolved.kind === 'several') return { candidates: resolved.candidates };
  const only = deps.drafts.findById(resolved.contest.id);
  if (!only) return { candidates: [] };
  return { id: only.id, content: only.content };
}

/** Adds a participant to one of the host's drafts, found by name. Reversible — not destructive. */
export class AddDraftParticipant {
  constructor(private readonly deps: ManageDraftParticipantsDeps) {}

  execute(hostId: string, contestName: string, displayName: string): ContestDetailsResult {
    const resolved = resolveDraft(this.deps, hostId, contestName);
    if (!('content' in resolved)) return resolved;

    const person: Person = { id: this.deps.ids.next(), displayName: displayName.trim() };
    const content: DraftContent = {
      ...resolved.content,
      participants: [...(resolved.content.participants ?? []), person],
    };
    const saved = this.deps.updateDraft.execute(resolved.id, hostId, content);
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

  execute(hostId: string, contestName: string, displayName: string): ContestDetailsResult {
    const resolved = resolveDraft(this.deps, hostId, contestName);
    if (!('content' in resolved)) return resolved;

    const wanted = displayName.trim().toLowerCase();
    const existing = resolved.content.participants ?? [];
    const removedIds = new Set(existing.filter((p) => p.displayName.toLowerCase() === wanted).map((p) => p.id));
    if (removedIds.size === 0) return { details: draftDetailsOf(resolved.id, resolved.content) };

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
    const saved = this.deps.updateDraft.execute(resolved.id, hostId, content);
    return { details: draftDetailsOf(resolved.id, saved.ok ? content : resolved.content) };
  }
}
