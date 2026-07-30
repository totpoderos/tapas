import type { StateTone } from '@tapas/ui';
import type { ContestSummary } from '../api/client';

export type ContestState = ContestSummary['status'];

/**
 * The shape that stands for each state, so it is never told by colour alone
 * (design.md §11C). Read alongside `common.contestState.*`, which is the word.
 */
export const STATE_MARK: Record<ContestState, string> = {
  live: '●',
  draft: '◇',
  closed: '◆',
  revealed: '✓',
};

/** The token family each state is drawn in. */
export const STATE_TONE: Record<ContestState, StateTone> = {
  live: 'good',
  draft: 'neutral',
  closed: 'pending',
  revealed: 'saffron',
};

/** The states the sidebar can narrow the list to. Closed and revealed are both finished. */
export type StateFilter = 'live' | 'draft' | 'finished';

export function matchesFilter(status: ContestState, filter: StateFilter): boolean {
  return filter === 'finished' ? status === 'closed' || status === 'revealed' : status === filter;
}
