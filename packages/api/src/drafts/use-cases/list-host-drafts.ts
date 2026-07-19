import type { DraftRepository } from '../../db/draft-repository.js';
import type { StoredDraft } from '../stored-draft.js';

/** Lists the drafts a host owns (query). */
export class ListHostDrafts {
  constructor(private readonly drafts: DraftRepository) {}

  execute(hostId: string): StoredDraft[] {
    return this.drafts.findByHost(hostId);
  }
}
