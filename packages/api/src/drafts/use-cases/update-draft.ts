import { Draft, type DraftContent } from '@tapas/domain';
import { IN_APP, type AuditProvenance } from '../../audit/audit-projection.js';
import type { StoredDraft } from '../stored-draft.js';
import { withParticipantIds, draftNotFound, findOwnedDraft, type DraftUseCaseDeps, type DraftWriteResult } from './shared.js';

/**
 * Replaces the whole content of a host's own draft — how it is scored, who is
 * taking part, the couple pairings, everything but the id. This is "real"
 * editing, beyond the name-only {@link RenameDraft}. A draft may be incomplete
 * or not-yet-publishable; only the name is required (the domain `Draft` enforces
 * that), and the full rules are validated later, at publish.
 */
export class UpdateDraft {
  constructor(private readonly deps: DraftUseCaseDeps) {}

  execute(draftId: string, hostId: string, content: DraftContent, provenance: AuditProvenance = IN_APP): DraftWriteResult {
    const existing = findOwnedDraft(this.deps.drafts, draftId, hostId);
    if (!existing) return { ok: false, error: draftNotFound };

    const edited = Draft.rehydrate(existing.id, existing.hostId, existing.content).withContent(withParticipantIds(content, this.deps.ids));
    if (!edited.ok) return { ok: false, error: edited.error };

    const updated: StoredDraft = { ...existing, content: edited.draft.content, updatedAt: this.deps.clock.now() };
    this.deps.drafts.update(updated);
    this.deps.audit.record(
      { type: 'draft.updated', contestId: draftId, actorId: hostId, before: existing.content, after: edited.draft.content },
      provenance,
    );
    return { ok: true, draft: updated };
  }
}
