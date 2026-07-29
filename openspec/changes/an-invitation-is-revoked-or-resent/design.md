## Context

The previous two slices left the invitation with one ending it reaches by
itself. This slice adds the two an administrator can cause, and with them the
first reason to look at invitations as a set.

Three things from those slices decide most of what follows:

- **`usabilityOf` is the single place that judges a link.** It was built that
  way in B2 precisely so a third condition would have one home. This slice adds
  two and is the test of whether that held.
- **Expiry is computed, not stored**, and `InvitationStatus` is deliberately
  `'pending' | 'accepted'` for that reason. Revoking and superseding are not
  like expiry, and the distinction matters (below).
- **An administrator never sees a token.** Every route so far names an
  invitation by the token in its link. An administrator has none, which is why
  listing is not an optional extra here.

## Goals / Non-Goals

**Goals:**

- Revoke and resend, both administrative, both leaving exactly one live link or
  none.
- A listing that makes both possible, and that an administrator can read
  without ever seeing a token.
- Two new unusable reasons that are invisible to whoever holds the link and
  fully visible to an auditor.
- Exactly one place still deciding whether a link works.

**Non-Goals:**

- Any screen. Slice C renders this list.
- Deleting an invitation. The record is the audit trail for an account that
  nearly existed; ending it is a status, not a deletion.
- Bulk actions, filtering, or paging. A single-operator deployment has a
  handful of invitations, and slice C can ask for more if it turns out to need
  it.

## Decisions

### Revoking and superseding are stored; expiry stays computed

The previous slice argued hard that expiry must not be a stored status. This
slice stores two statuses, and the reasoning is not in tension: expiry is a
question about the clock that anyone can answer at any time, whereas revoking
and superseding are **events**, with a moment and an actor. There is no
function of `issuedAt` and `now` that yields "an administrator changed their
mind."

So `InvitationStatus` becomes `'pending' | 'accepted' | 'revoked' |
'superseded'`, with `revoked_at` and `superseded_by` joining `accepted_at`.
`superseded_by` names the invitation that replaced it, which is what lets the
listing show a chain rather than a mysterious dead record.

### Superseded is its own status, not a kind of revoked

A resend could simply revoke the old invitation. Keeping them apart costs one
enum value and buys an honest audit trail: "this was cancelled" and "this was
replaced" are different administrative acts, and a listing that conflates them
makes an administrator guess which one they did.

It also matters for what may follow. Resending a revoked invitation is refused
because revoking was a decision; if resend had been implemented as revoke, that
rule would have made resending a resent invitation impossible too, for no
reason anybody chose.

### Time can be undone; decisions cannot

An expired invitation may be resent. An accepted, revoked or superseded one may
not.

The line is not arbitrary. Expiry is something that happened to an invitation
while nobody was looking, and resending is exactly the remedy for it — it is
the case the design notes named when they said an administrator may resend.
The other three are outcomes somebody chose, and a resend that reached past
them would quietly undo a decision: un-revoking by the back door, or issuing a
second live link for an account that already exists.

### Revoking is refused for anything not currently usable

Including expired. Revoking exists to make a live link dead; an expired link is
already dead, and reporting "there is nothing to revoke" is more honest than
silently writing a status that changes nothing.

This costs a small thing: slice C must not offer revoke on a row it is showing
as expired. That is the correct behavior for the screen anyway, and getting the
answer from the API rather than inventing it in the UI is the better direction
of dependency.

### The listing computes expiry through the same predicate

The list shows an invitation as expired although its stored status says
pending. That is a second reader of "is this still good?", and the obvious way
to write it — a fresh comparison of `issuedAt` against now — is precisely how
two answers drift apart.

So the listing derives its displayed status from `usabilityOf`, the same
function the anonymous routes ask. One predicate, three callers, no second
opinion.

### Revoking and resending are named by invitation id

The administrative routes take the invitation's id, which the listing provides
and `POST /admin/invites` already returns. No administrative route ever accepts
or returns a token: an administrator who could read a link could accept an
invitation on someone else's behalf, and nothing about revoking or resending
needs that power.

## Risks / Trade-offs

- **Five unusable reasons, one message** → The refusal stays a single constant
  and the reasons stay internal. The risk is a future route that helpfully
  reports which one applied; the acceptance scenarios assert byte-identical
  responses across all five, so that would fail loudly.
- **`superseded_by` invites a chain that could loop** → Each resend points at a
  strictly newer invitation and the old one becomes terminal, so the chain is
  acyclic by construction. Nothing follows it recursively in this slice.
- **A resend races an acceptance** → Someone accepting at the instant an
  administrator resends could have their link superseded mid-request. The
  window is a single request and the outcome is safe either way — either the
  account is created and the resend then finds a non-usable invitation, or the
  acceptance finds it superseded and refuses. Both leave exactly one account or
  none; neither leaves two live links.
- **The listing grows unbounded** → Every resend adds a record and nothing is
  ever deleted, because the record is audit. For a single-operator deployment
  this is a non-issue; if slice C finds it noisy, filtering superseded rows is a
  display concern, not a reason to delete history.

## Migration Plan

One migration adding `revoked_at` and `superseded_by` to `host_invitations`,
both nullable. Existing rows are unaffected: they are all `pending` or
`accepted`, and both new columns are null for them. The status column is
untyped text with no constraint, so the two new values need no schema change of
their own. Rollback is dropping the columns and the new routes; no existing
data is rewritten.

## Open Questions

- Should the listing hide superseded invitations by default? Left to slice C,
  which will know what the screen looks like. The API returns everything and
  says how each one stands.
