import { Draft, type DraftContent } from '@tapas/domain';
import { IN_APP, type AuditProvenance } from '../../audit/audit-projection.js';
import type { StoredDraft } from '../stored-draft.js';
import { withAssignedIds, type DraftUseCaseDeps, type DraftWriteResult } from './shared.js';

/** Creates a new draft for a host. Invariants are enforced by the domain `Draft`. */
export class CreateDraft {
  constructor(private readonly deps: DraftUseCaseDeps) {}

  async execute(hostId: string, content: DraftContent, provenance: AuditProvenance = IN_APP): Promise<DraftWriteResult> {
    // Participants and categories may both arrive without ids (the assistant
    // sends names); assign them before the domain sees the draft — see
    // withAssignedIds.
    const withIds = withAssignedIds(content, this.deps.ids);
    const created = Draft.create(this.deps.ids.next(), hostId, withIds);
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
    await this.deps.drafts.insert(stored);
    await this.deps.audit.record(
      { type: 'draft.saved', contestId: stored.id, actorId: hostId, after: content },
      provenance,
    );
    return { ok: true, draft: stored };
  }
}
