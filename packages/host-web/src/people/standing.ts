import type { StateTone } from '@tapas/ui';
import type { Standing } from './merge-people';

/**
 * The shape that stands for each standing, so it is never told by colour alone
 * (design.md §11C). Read alongside `people.standing.*`, which is the word.
 *
 * Kept beside the model rather than inside the screen, for the same reason the
 * contest states are: the mark, the tone and the word have to be added together
 * when a standing is added, and one file makes that one edit.
 */
export const STANDING_MARK: Record<Standing, string> = {
  administrator: '★',
  host: '●',
  pending: '◔',
  expired: '◇',
  revoked: '✕',
  superseded: '↺',
};

/** The token family each standing is drawn in. */
export const STANDING_TONE: Record<Standing, StateTone> = {
  administrator: 'brand',
  host: 'good',
  pending: 'pending',
  // Expired and revoked are different endings: one ran out, one was taken back.
  expired: 'danger',
  revoked: 'neutral',
  superseded: 'neutral',
};

/**
 * What can still be done about a person, by where their invitation stands.
 *
 * Revoking an invitation that is already revoked does nothing, and offering it
 * says the screen has not understood its own list. An expired one can be sent
 * again but has nothing left to take back. Somebody with an account is not an
 * invitation at all.
 */
export const STANDING_ACTIONS: Record<Standing, readonly ('resend' | 'revoke')[]> = {
  administrator: [],
  host: [],
  pending: ['resend', 'revoke'],
  // Expired: worth another try, nothing left to withdraw.
  expired: ['resend'],
  revoked: [],
  superseded: [],
};
