import type { Clock, IdGenerator } from '../../audit/audit-projection.js';
import type { AuditRecorder } from '../../audit/audit-recorder.js';
import type { DraftRepository } from '../../db/draft-repository.js';
import type { StoredDraft } from '../stored-draft.js';

export type DraftFailureCode = 'NAME_REQUIRED' | 'DRAFT_NOT_FOUND';

export interface DraftFailure {
  readonly code: DraftFailureCode;
  readonly message: string;
}

/** Dependencies for the write use cases. Queries take only the repository. */
export interface DraftUseCaseDeps {
  readonly drafts: DraftRepository;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

export type DraftWriteResult =
  | { readonly ok: true; readonly draft: StoredDraft }
  | { readonly ok: false; readonly error: DraftFailure };

export type DiscardResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: DraftFailure };

export const draftNotFound: DraftFailure = { code: 'DRAFT_NOT_FOUND', message: 'No such draft.' };

/** Ownership check (OWASP A01): returns the draft only if it belongs to the host. */
export function findOwnedDraft(
  drafts: DraftRepository,
  draftId: string,
  hostId: string,
): StoredDraft | undefined {
  const draft = drafts.findById(draftId);
  return draft && draft.hostId === hostId ? draft : undefined;
}
