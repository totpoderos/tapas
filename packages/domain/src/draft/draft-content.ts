import type { ContestFormat, Person, ScoringConfig } from '../model.js';

/** When a contest stops accepting votes. */
export type CloseRule = { readonly when: 'all_sent' | 'host_trigger' } | {
  readonly when: 'scheduled';
  readonly at: string;
};

/** When winners are announced. */
export type RevealStrategy = { readonly when: 'host_trigger' } | { readonly when: 'scheduled'; readonly at: string };

/**
 * The editable content of a draft. A draft is a work-in-progress: only `name`
 * is required; the rule-space config and participants are filled in over time
 * and fully validated at publish.
 */
export interface DraftContent {
  readonly name: string;
  readonly theme?: string;
  readonly format?: ContestFormat;
  readonly scoring?: ScoringConfig;
  readonly participants?: readonly Person[];
  readonly closeRule?: CloseRule;
  readonly revealStrategy?: RevealStrategy;
}
