import type { AuditEntry } from '../api/client';

/**
 * How a recorded action is named to a host, and how the way it was triggered is
 * marked.
 *
 * Shared by the activity log and the control room's recent activity, which show
 * the same events and must call them the same things. Two copies of this map would
 * be two places to add the next event type to, and the one nobody remembered would
 * quietly start showing raw event names.
 */

/** Known event types map to a translation key under `auditLog.event`. */
const EVENT_KEY: Record<string, string> = {
  'draft.saved': 'draftSaved',
  'draft.updated': 'draftUpdated',
  'draft.discarded': 'draftDiscarded',
  'contest.published': 'contestPublished',
  'contest.closed': 'contestClosed',
  'contest.revealed': 'contestRevealed',
};

/**
 * The translation key for an event, or `undefined` for a type this app does not
 * know about — in which case the caller shows the raw type. That is data, and
 * showing it is better than a blank where a missing key would be.
 */
export function eventKeyFor(type: string): string | undefined {
  return EVENT_KEY[type];
}

/** A shape per source, so how an action was triggered is never told by colour alone. */
export const SOURCE_MARK: Record<AuditEntry['sourcePath'], string> = {
  form: '◇',
  system: '◈',
  mcp: '⬡',
};
