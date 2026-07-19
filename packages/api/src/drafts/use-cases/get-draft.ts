import type { DraftRepository } from '../../db/draft-repository.js';
import type { StoredDraft } from '../stored-draft.js';
import { findOwnedDraft } from './shared.js';

/** Reads a host's own draft (query). */
export class GetDraft {
  constructor(private readonly drafts: DraftRepository) {}

  execute(draftId: string, hostId: string): StoredDraft | undefined {
    return findOwnedDraft(this.drafts, draftId, hostId);
  }
}
