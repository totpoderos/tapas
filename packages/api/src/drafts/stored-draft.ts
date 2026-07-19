import type { DraftContent } from '@tapas/domain';

/** A persisted draft, owned by a host. Its id carries through to the contest on publish. */
export interface StoredDraft {
  readonly id: string;
  readonly hostId: string;
  readonly content: DraftContent;
  readonly status: 'draft';
  readonly createdAt: string;
  readonly updatedAt: string;
}
