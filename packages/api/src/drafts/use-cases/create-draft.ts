import { Draft, type DraftContent } from '@tapas/domain';
import type { SourcePath } from '@tapas/shared';
import type { StoredDraft } from '../stored-draft.js';
import type { DraftUseCaseDeps, DraftWriteResult } from './shared.js';

/** Creates a new draft for a host. Invariants are enforced by the domain `Draft`. */
export class CreateDraft {
  constructor(private readonly deps: DraftUseCaseDeps) {}

  execute(hostId: string, content: DraftContent, sourcePath: SourcePath = 'form'): DraftWriteResult {
    const created = Draft.create(this.deps.ids.next(), hostId, content);
    if (!created.ok) return { ok: false, error: created.error };

    const now = this.deps.clock.now();
    const stored: StoredDraft = {
      id: created.draft.id,
      hostId,
      content: created.draft.content,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    this.deps.drafts.insert(stored);
    this.deps.audit.record(
      { type: 'draft.saved', contestId: stored.id, actorId: hostId, after: content },
      { sourcePath },
    );
    return { ok: true, draft: stored };
  }
}
