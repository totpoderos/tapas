## Why

An invitation can currently only be waited out. An administrator who invites
the wrong address, or the right address for the wrong person, has no way to
take it back — the link stays live for a day whatever they do. And a person
whose invitation expired, or whose message went to a spam folder, has no way
back in at all: nothing issues them a second one.

Those are the two ends of the same gap, and closing them completes the
invitation's life. It also gives an administrator the first reason to look at
invitations as a list rather than as something that happens once and vanishes.

## What Changes

- An administrator can revoke an invitation that is still usable. Its link dies
  at that moment.
- An administrator can resend an invitation. Resending does not revive
  anything: it issues a **new** invitation with a new token and a fresh 24-hour
  window, and the old one dies at that moment. Two records, one of them
  superseded — because a link that was already mailed cannot be un-mailed, and
  pretending otherwise would leave two live tokens for one invitation.
- **Time can be undone; decisions cannot.** An expired invitation can be
  resent, because expiring is something that happened to it. An accepted,
  revoked or superseded one cannot, because each of those is a decision
  somebody made.
- Revoked and superseded join unknown, used and expired as reasons a link does
  not work — and, like them, are indistinguishable to whoever holds it. Five
  reasons, one answer, and the security log keeps all five apart.
- An administrator can see the invitations, which is what makes revoking and
  resending possible at all: every route so far names an invitation by its
  token, which an administrator does not have and should never need.

## Capabilities

### Modified Capabilities

- `host-enrollment`: the invitation's life gains its two remaining endings. The
  requirement that a link works once and only for a while extends to cover a
  link ended early, and the requirement that an unusable link says nothing
  about why grows from three reasons to five.
- `security-event-logging`: revoking and resending are recorded, and the
  refused-acceptance event learns the two new reasons.

## Impact

- Migration adding `revoked_at` and `superseded_by` to the invitation table.
  Unlike expiry — which is a question about the clock and so is computed —
  revoking and superseding are events with a moment and an actor, so they are
  recorded.
- `packages/api/src/auth/use-cases/invitation-shared.ts` — `usabilityOf` gains
  its third and fourth unusable reasons. It was built in the previous slice to
  be the one place this could happen, and this slice is the test of that.
- New administrative routes for listing, revoking and resending, behind the
  check from slice A. Nothing anonymous changes.
- The list must report an invitation as expired without the stored status ever
  saying so — the same computation the two anonymous routes already do, and a
  place where a second, subtly different answer could easily creep in.
- `packages/api/src/security/security-event.ts` — two new event types.
- No frontend. The screens that render this list are slice C.
