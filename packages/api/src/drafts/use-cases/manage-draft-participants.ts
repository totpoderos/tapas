import type { DraftContent, Person } from '@tapas/domain';
import type { IdGenerator } from '../../audit/audit-projection.js';
import type { ContestDetails, ContestDetailsResult } from '../../contests/contest-details.js';
import type { FindContestsByName } from '../../contests/use-cases/find-contests-by-name.js';
import type { DraftRepository } from '../../db/draft-repository.js';
import type { UpdateDraft } from './update-draft.js';

export interface ManageDraftParticipantsDeps {
  readonly findContestsByName: FindContestsByName;
  readonly drafts: DraftRepository;
  readonly updateDraft: UpdateDraft;
  readonly ids: IdGenerator;
}

/** The details view of a draft after a participant change — reused for the result. */
function detailsOf(id: string, content: DraftContent): ContestDetails {
  return {
    id,
    name: content.name,
    status: 'draft',
    participants: (content.participants ?? []).map((p) => p.displayName),
    categories: (content.scoring?.categories ?? []).map((c) => c.name),
  };
}

/**
 * Resolves a contest name to exactly one of the host's *drafts*. Participant
 * management is for drafts only: once a contest is published its participants are
 * settled (the roster is seeded at publish). A name shared by more than one draft
 * returns the candidates to choose from; a name that matches no draft (including a
 * name that only a published contest or another host has) returns none.
 */
function resolveDraft(
  deps: ManageDraftParticipantsDeps,
  hostId: string,
  contestName: string,
): { readonly id: string; readonly content: DraftContent } | ContestDetailsResult {
  const drafts = deps.findContestsByName.execute(hostId, contestName).filter((c) => c.status === 'draft');
  if (drafts.length !== 1) return { candidates: drafts };
  const only = deps.drafts.findById(drafts[0]!.id);
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
    return { details: detailsOf(resolved.id, saved.ok ? content : resolved.content) };
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
    if (removedIds.size === 0) return { details: detailsOf(resolved.id, resolved.content) };

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
    return { details: detailsOf(resolved.id, saved.ok ? content : resolved.content) };
  }
}
