import type { DomainEvent } from '@tapas/domain';
import type { DraftContent, SourcePath, StoredDraft } from '@tapas/shared';
import type { AuditRecorder } from '../audit/audit-recorder.js';
import type { Clock, IdGenerator } from '../audit/audit-projection.js';
import type { DraftRepository } from '../db/draft-repository.js';

export type DraftErrorCode = 'NAME_REQUIRED' | 'DRAFT_NOT_FOUND';

export interface DraftError {
  readonly code: DraftErrorCode;
  readonly message: string;
}

export type DraftResult =
  | { readonly ok: true; readonly draft: StoredDraft }
  | { readonly ok: false; readonly error: DraftError };

export type DiscardResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: DraftError };

export interface DraftServiceDeps {
  readonly drafts: DraftRepository;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

function err(code: DraftErrorCode, message: string): { ok: false; error: DraftError } {
  return { ok: false, error: { code, message } };
}

/** The authoritative validator (design task 2.5), independent of any LLM schema. */
function validate(content: DraftContent): DraftError | null {
  if (content.name.trim().length === 0) return { code: 'NAME_REQUIRED', message: 'A draft needs a name.' };
  return null;
}

/**
 * Owns the lifecycle of contest drafts (form path). Persistence is behind a
 * repository; every mutation emits a domain event recorded to the audit log.
 * A host only ever operates on their own drafts (ownership check, OWASP A01).
 */
export class DraftService {
  constructor(private readonly deps: DraftServiceDeps) {}

  save(hostId: string, content: DraftContent, sourcePath: SourcePath = 'form'): DraftResult {
    const invalid = validate(content);
    if (invalid) return { ok: false, error: invalid };

    const now = this.deps.clock.now();
    const draft: StoredDraft = {
      id: this.deps.ids.next(),
      hostId,
      content,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    this.deps.drafts.insert(draft);
    this.emit({ type: 'draft.saved', contestId: draft.id, actorId: hostId, after: content }, sourcePath);
    return { ok: true, draft };
  }

  rename(draftId: string, hostId: string, newName: string, sourcePath: SourcePath = 'form'): DraftResult {
    const existing = this.owned(draftId, hostId);
    if (!existing) return err('DRAFT_NOT_FOUND', 'No such draft.');

    const after: DraftContent = { ...existing.content, name: newName };
    const invalid = validate(after);
    if (invalid) return { ok: false, error: invalid };

    const updated: StoredDraft = { ...existing, content: after, updatedAt: this.deps.clock.now() };
    this.deps.drafts.update(updated);
    this.emit(
      { type: 'draft.updated', contestId: draftId, actorId: hostId, before: existing.content, after },
      sourcePath,
    );
    return { ok: true, draft: updated };
  }

  discard(draftId: string, hostId: string, sourcePath: SourcePath = 'form'): DiscardResult {
    const existing = this.owned(draftId, hostId);
    if (!existing) return err('DRAFT_NOT_FOUND', 'No such draft.');

    this.deps.drafts.delete(draftId);
    this.emit({ type: 'draft.discarded', contestId: draftId, actorId: hostId, before: existing.content }, sourcePath);
    return { ok: true };
  }

  get(draftId: string, hostId: string): StoredDraft | undefined {
    return this.owned(draftId, hostId);
  }

  list(hostId: string): StoredDraft[] {
    return this.deps.drafts.findByHost(hostId);
  }

  private owned(draftId: string, hostId: string): StoredDraft | undefined {
    const draft = this.deps.drafts.findById(draftId);
    return draft && draft.hostId === hostId ? draft : undefined;
  }

  private emit(event: DomainEvent, sourcePath: SourcePath): void {
    this.deps.audit.record(event, { sourcePath });
  }
}
