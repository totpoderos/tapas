import type { DraftRepository } from '../../db/draft-repository.js';
import type { StoredDraft } from '../stored-draft.js';
import { findOwnedDraft } from './shared.js';

/** Reads a host's own draft (query). */
export class GetDraft {
  constructor(private readonly drafts: DraftRepository) {}

  async execute(draftId: string, hostId: string): Promise<StoredDraft | undefined> {
    return await findOwnedDraft(this.drafts, draftId, hostId);
  }
}
