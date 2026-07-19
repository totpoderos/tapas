import { Draft } from '@tapas/domain';
import type { SourcePath } from '@tapas/shared';
import type { StoredDraft } from '../stored-draft.js';
import { draftNotFound, findOwnedDraft, type DraftUseCaseDeps, type DraftWriteResult } from './shared.js';

/** Renames a host's own draft. The domain `Draft` enforces the name invariant. */
export class RenameDraft {
  constructor(private readonly deps: DraftUseCaseDeps) {}

  execute(draftId: string, hostId: string, newName: string, sourcePath: SourcePath = 'form'): DraftWriteResult {
    const existing = findOwnedDraft(this.deps.drafts, draftId, hostId);
    if (!existing) return { ok: false, error: draftNotFound };

    const renamed = Draft.rehydrate(existing.id, existing.hostId, existing.content).rename(newName);
    if (!renamed.ok) return { ok: false, error: renamed.error };

    const updated: StoredDraft = { ...existing, content: renamed.draft.content, updatedAt: this.deps.clock.now() };
    this.deps.drafts.update(updated);
    this.deps.audit.record(
      { type: 'draft.updated', contestId: draftId, actorId: hostId, before: existing.content, after: renamed.draft.content },
      { sourcePath },
    );
    return { ok: true, draft: updated };
  }
}
