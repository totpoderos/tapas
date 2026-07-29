export const INVITATION_LIFETIME_HOURS = 24;

const LIFETIME_MS = INVITATION_LIFETIME_HOURS * 60 * 60 * 1000;

/**
 * Whether an invitation issued at `issuedAtIso` has run out of time by
 * `nowIso`. It becomes unusable at the instant the window closes, not after it.
 *
 * Expiry is a question about the clock rather than a state kept on the
 * invitation: nothing in this system runs on a schedule, so a stored "expired"
 * would say "pending" for as long as nobody looked, and would only correct
 * itself at the moment the computed answer was available anyway.
 *
 * The current time is passed in — the domain has no clock — the same way the
 * account lockout in {@link HostAccount} works.
 */
export function invitationHasExpired(issuedAtIso: string, nowIso: string): boolean {
  return Date.parse(nowIso) >= Date.parse(issuedAtIso) + LIFETIME_MS;
}
