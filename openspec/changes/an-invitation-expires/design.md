## Context

The previous slice stored `issued_at` on every invitation and deliberately read
nothing from it, so that giving invitations a lifetime would be a change of
behavior rather than a change of schema. This is that change.

Two things in the existing code shape it:

- **Two use cases ask the same question separately.** `OpenInvitation` and
  `AcceptInvitation` each independently check `status !== 'pending'`. A second
  condition added to both is exactly the shape of bug this codebase keeps
  producing: two paths that are supposed to agree, diverging in one layer.
- **The domain already owns a time-based policy.** `HostAccount` holds
  `LOCK_DURATION_MINUTES` and answers `isLocked(nowIso)` with the current time
  passed in, because the domain has no clock. An invitation's lifetime is the
  same kind of rule and belongs in the same place.

## Goals / Non-Goals

**Goals:**

- An invitation stops working 24 hours after it was issued, on both routes.
- Exactly one place decides whether an invitation is usable, so the two routes
  cannot drift.
- The caller learns nothing new; the security log learns one thing more.
- No migration, and no new stored state.

**Non-Goals:**

- Reviving an expired invitation. There is deliberately no path from expired
  back to usable — a fresh invitation with a new token is the answer, and
  issuing one is slice B3.
- Telling an administrator that an invitation has expired. That is a screen,
  and screens are slice C.
- Any change to what a caller sees. The response for an expired link is
  byte-for-byte the response for an unknown one.

## Decisions

### Expiry is computed, not stored

Whether an invitation has expired is a question about the clock, answered when
someone asks. It is not a fact recorded on the row.

The alternative is a stored status that becomes `expired`, which the state
diagram in the design notes suggests. It does not survive contact with the
implementation: nothing in this system runs on a schedule, so a row would sit
saying `pending` for as long as nobody touched it, and would only become
`expired` at the moment something looked at it — which is precisely when the
computed answer would have been available anyway. The stored value would be
wrong for the entire interval it was supposed to describe.

So `InvitationStatus` stays `'pending' | 'accepted'`, and expiry is a predicate
over `issuedAt` and the current time. Slice C's admin list computes it the same
way for display.

### The rule lives in the domain, beside the lockout

The lifetime and the judgment go in `packages/domain`, next to the account
lockout, with the current time passed in — the domain has no clock. This keeps
the two time-based policy rules in the system in one place rather than one in
the domain and one buried in a use case.

A full `Invitation` entity mirroring `HostAccount` was considered and is not
worth it yet: this slice needs one predicate, and the stored record is a
transport concern in the API layer. If B3's transitions grow — revoked, resent,
superseded — the entity becomes the natural home and this function moves onto
it.

### One predicate, called by both routes

`OpenInvitation` and `AcceptInvitation` both stop asking `status === 'pending'`
directly and both call a single `isUsable(invitation, now)`. Adding a second
condition to two places independently is how the cookie path and the token path
drifted before; the fix is to leave only one place for a third condition to be
added to.

`AcceptInvitation` already takes a clock. `OpenInvitation` does not and gains
one — the only reason its dependencies change.

### Expired at exactly the boundary

An invitation is usable while `now` is strictly before `issuedAt + 24h`, and
unusable from that instant onward. Stating it explicitly so that the boundary
case has one answer rather than two plausible ones; the tests pin it.

### The reason goes to the log and nowhere else

The refusal returned to the caller is unchanged — same status, same code, same
message, no address. The security event gains a reason saying the link had
expired, using the `reason` field the event input already carries for refused
sign-ins. An auditor can then separate a person arriving too late from someone
guessing at tokens, which is exactly the distinction the caller is denied.

## Risks / Trade-offs

- **Invitations issued before this ships stop working if they are already a day
  old** → Intended, and the reason the timestamp was written from the start.
  Worth knowing rather than discovering: at deploy, every pending invitation
  older than 24 hours becomes unusable at once. Nothing in the system has issued
  a real one yet, so the practical impact is zero, but the same reasoning will
  not hold for later policy changes.
- **The window is not configurable** → 24 hours is a constant, as the lockout
  duration is. Making it configuration invites a deployment where it is set to
  something useless, and nothing has asked for it.
- **A person can lose their only way in by being slow** → True, and it is why
  the previous slice was careful that a mistyped password does not spend the
  invitation. Until B3 adds resending, an expired invitation needs an
  administrator to issue a new one, and B3 is the next slice for that reason.
- **Computing expiry means every reader must remember to** → Mitigated by there
  being exactly one predicate and no caller that reaches past it. A second
  reader that checks `status` alone would be the bug; the shared predicate is
  what makes that hard to write by accident.

## Migration Plan

None. No schema change, no backfill, no data touched. The change is entirely in
what the two use cases ask before they answer, and it is reversible by removing
the condition.

## Open Questions

None. The window, the boundary, the storage question and the refusal shape are
all settled above.
