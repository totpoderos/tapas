import type { CloseRule } from '../draft/draft-content.js';

export interface AutoCloseFacts {
  /**
   * Whether every place on the roster has sent a vote. Ignored unless `when` is
   * `all_sent`.
   *
   * Every PLACE, not every place claimed so far. Asking only about the claimed
   * ones closed the contest as soon as the first participant sent — early in an
   * evening the claimed set is one person — and a closed contest refuses scores
   * and dishes, so everybody still to arrive was locked out with no way back.
   *
   * The cost of this reading is that somebody who never turns up holds the
   * contest open, and the host closes it by hand. That is the right way round:
   * the system cannot tell "not here yet" from "not coming", and the host is
   * standing in the room.
   */
  readonly allPlacesSent: boolean;
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
      return facts.allPlacesSent;
    case 'scheduled':
      return Date.parse(nowIso) >= Date.parse(closeRule.at);
  }
}
