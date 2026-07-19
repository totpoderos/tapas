import type { AntiBias, Attribution, Person, ScoringConfig } from '@tapas/domain';

/** When a contest stops accepting votes. */
export type CloseRule = { readonly when: 'all_sent' | 'host_trigger' } | {
  readonly when: 'scheduled';
  readonly at: string;
};

/** When winners are announced. */
export type RevealStrategy = { readonly when: 'host_trigger' } | { readonly when: 'scheduled'; readonly at: string };

/**
 * The editable content of a draft. A draft is a work-in-progress: only `name`
 * is required to save; the rule-space config and participants are filled in
 * over time and fully validated at publish.
 */
export interface DraftContent {
  readonly name: string;
  readonly theme?: string;
  readonly attribution?: Attribution;
  readonly antiBias?: AntiBias;
  readonly scoring?: ScoringConfig;
  readonly participants?: readonly Person[];
  readonly closeRule?: CloseRule;
  readonly revealStrategy?: RevealStrategy;
}

export type DraftStatus = 'draft';

/** A persisted draft, owned by a host. Its id carries through to the contest on publish. */
export interface StoredDraft {
  readonly id: string;
  readonly hostId: string;
  readonly content: DraftContent;
  readonly status: DraftStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
