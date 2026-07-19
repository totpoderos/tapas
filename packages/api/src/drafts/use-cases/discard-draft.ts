import type { SourcePath } from '@tapas/shared';
import { draftNotFound, findOwnedDraft, type DiscardResult, type DraftUseCaseDeps } from './shared.js';

/** Discards a host's own draft. */
export class DiscardDraft {
  constructor(private readonly deps: DraftUseCaseDeps) {}

  execute(draftId: string, hostId: string, sourcePath: SourcePath = 'form'): DiscardResult {
    const existing = findOwnedDraft(this.deps.drafts, draftId, hostId);
    if (!existing) return { ok: false, error: draftNotFound };

    this.deps.drafts.delete(draftId);
    this.deps.audit.record(
      { type: 'draft.discarded', contestId: draftId, actorId: hostId, before: existing.content },
      { sourcePath },
    );
    return { ok: true };
  }
}
