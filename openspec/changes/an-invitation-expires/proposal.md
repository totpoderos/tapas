## Why

An invitation issued by the previous slice is good forever. A link mailed once
and never used stays a working credential for a host account indefinitely — in
an old inbox, in a forwarded message, in a mail archive, in a backup. Nothing
ages it out.

That is the whole gap this slice closes. The record already carries the moment
it was issued, written from the start so that adding a lifetime would be a
change of behavior rather than a change of schema. This slice reads it.

## What Changes

- An invitation is good for 24 hours from when it was issued. After that its
  link no longer opens and no longer accepts.
- An expired link is refused with the same message as a link that never existed
  and a link already used. Three different reasons, one answer — a person
  holding a link that does not work learns nothing about why, and in particular
  nothing about whether an invitation was ever issued for that address.
- The security log distinguishes what the caller is not told: a refusal for an
  expired link is recorded as such, so an auditor can tell an expiry from a
  guessing attempt while the guesser cannot.
- Nothing revives an expired invitation. A fresh invitation with a new token is
  how someone gets back in, and issuing one is the next slice's work.

Not in this slice: revoking and resending (B3), any screen (C), and the removal
of open registration (E).

## Capabilities

### Modified Capabilities

- `host-enrollment`: an invitation gains a lifetime. The requirement that a
  link works only once becomes a requirement that it works only once and only
  for a while, and the requirement that an unusable link says nothing about why
  extends to cover expiry as a third indistinguishable reason.
- `security-event-logging`: the refused-acceptance event gains the ability to
  say that the link had expired, keeping the distinction the caller is denied.

## Impact

- No migration. `issued_at` already exists and is already written; nothing new
  is stored, because whether an invitation has expired is a question about the
  clock rather than a fact to record. A status column that said `expired` would
  be wrong from the moment it was written until something touched the row.
- `packages/domain` — the lifetime and the judgment "is this expired?" join the
  account-lockout invariant that already lives there, so the rule sits with the
  other time-based policy rather than in a use case.
- `packages/api/src/auth/use-cases/open-invitation.ts` and `accept-invitation.ts`
  — both currently ask only whether the invitation is pending, and must now also
  ask whether it is still in time.
- `packages/api/src/http/invitation-routes.ts` — the refusal it records gains a
  reason, while the refusal it returns stays exactly as it is.
- No route, request or response shape changes. An expired link is refused
  through the path that already refuses unusable links.
