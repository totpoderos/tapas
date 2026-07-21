import type { CloseRule } from '../draft/draft-content.js';

export interface AutoCloseFacts {
  /** Whether every participant who claimed a place has sent their vote. Ignored unless `when` is `all_sent`. */
  readonly allClaimedSent: boolean;
}

/**
 * Whether a live contest should auto-close right now, given its close rule.
 * `host_trigger` never auto-closes — only an explicit host action closes it.
 * A pure function: no I/O, no persistence.
 */
export function shouldAutoClose(closeRule: CloseRule, facts: AutoCloseFacts, nowIso: string): boolean {
  switch (closeRule.when) {
    case 'host_trigger':
      return false;
    case 'all_sent':
      return facts.allClaimedSent;
    case 'scheduled':
      return Date.parse(nowIso) >= Date.parse(closeRule.at);
  }
}
