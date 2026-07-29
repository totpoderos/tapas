## Context

Slice A landed the administrative check (`require-administrator.ts`) and one
administrative route. This slice hangs the first real administrative action off
it and introduces the invitation itself.

Three existing things shape the design:

- **`host_pats` is the precedent for a single-use secret.** A high-entropy
  random token, only its SHA-256 stored, a unique index on the hash for O(1)
  lookup (`pat-hasher.ts`, migration `0007_host_pats.sql`). An invitation token
  is the same kind of secret and gets the same treatment. It is not a password,
  so it needs no slow hash — its entropy is the defense.
- **`RegisterHost` already owns the account-creation rules.** Email validation,
  the password policy, the taken-email check and the bcrypt hash all live there
  (`register-host.ts`). Acceptance must call it rather than restate it, or the
  invited path and the open path drift.
- **Nothing in the system sends anything.** This is the first outbound side
  effect, and the first collaborator that can fail for reasons unrelated to the
  request.

## Goals / Non-Goals

**Goals:**

- One route by which a host account is created by invitation, end to end,
  behind the administrative check.
- A mailer expressed as a port, with an in-memory fake, so `npm run dev` and
  the whole test suite stay offline.
- A token that is spent by accepting and by nothing else.
- Refusals that say nothing: one message for unknown, one for used, no address
  disclosed.
- Reuse of `RegisterHost`, so the invited path and the open path cannot diverge
  on what a valid account is.

**Non-Goals:**

- Expiry (slice B2), revocation and resending (slice B3). The stored record
  carries the timestamps those slices need, but nothing reads them yet.
- A real mail provider, Mailpit, or compose wiring — slice C, where the
  Playwright suite first needs a message it can actually read.
- Any screen. The invite form and the acceptance page are slice C.
- Removing `POST /auth/register` (slice E) or inviting an administrator
  (bootstrap slice, D).

## Decisions

### The token is spent on accepting, never on opening

Opening the link is a read: it reports that the invitation is good and which
address it is for, and writes nothing. Acceptance — the request that carries the
chosen password — is what marks it accepted.

The alternative, marking it consumed when the link is first fetched, breaks on
contact with real mail: Outlook Safe Links, Proofpoint and similar products
fetch every URL in a message before delivering it. An invitation consumed on
open would be dead before its recipient ever clicked. This is not a
hypothetical for a system whose entire enrollment path is a mailed link.

It follows that both routes are anonymous and both take the sensitive rate
limit. The read route is the more attractive target — it is the one an attacker
would use to hunt for valid tokens — and it is the one the first draft of this
design forgot to limit.

### Acceptance does not issue a session

The acceptance route creates the account and stops. Signing in afterwards goes
through the existing sign-in path.

The alternative — issuing cookies directly from acceptance — is friendlier by
one round trip and costs a second place in the system that mints sessions, with
its own obligation to record a successful sign-in or leave the security log
with a session that no sign-in explains. The frontend already solves this
shape: registering and then signing in is what the host app does today. Slice C
will do the same on the acceptance page.

### The invitation is refused for an address that already has an account

Checked when inviting, not left to fail at acceptance. `RegisterHost` would
refuse the taken email at the end of the flow, which means the invited person
would follow a good link, choose a password and only then be told they cannot
have an account — with the invitation now in an awkward state. Refusing at the
point of invitation keeps the failure with the administrator, who can act on it.

This does leak, to an administrator, whether an address is registered. That is
information an administrator can already get from the host list that slice A
built, so nothing new is disclosed.

### A failed acceptance leaves the invitation pending

A weak password is refused without touching the invitation. Only a successful
account creation marks it accepted.

This matters more than it looks: with expiry arriving in B2 and no resend until
B3, an invitation spent by a mistyped password would leave that person with no
way in and no way to ask for another. The ordering of the slices makes the
failure mode worse than it would be in a finished system, so the rule is worth
stating now rather than discovering later.

### The mailer is a port with an in-memory fake

An interface in the API with one method — send a message to an address — and a
fake that records what it was asked to send, which the acceptance specs assert
against. No transport, no configuration, no environment variables in this
slice.

The alternative of introducing SMTP and Mailpit now would add a service to
`npm run dev` for a slice that has no screen to exercise it. Slice C is the
first place a real message must cross a real wire, and it can bring the
transport with it.

### One generic refusal, and the log as the only record

Unknown and already-used produce the same answer, naming no address. The
security log is where the distinction survives, which is the same division of
labour the sign-in path already uses: a caller learns nothing, an auditor learns
everything.

## Risks / Trade-offs

- **The read route is a token oracle** → It is anonymous and reveals an address
  for a valid token. Mitigated by the token's entropy (the `host_pats`
  generator, 32 random bytes) and the sensitive rate limit; a guessing attack
  is not viable against either.
- **An invitation carries an address that has no account yet** → Until B2 adds
  expiry, a pending invitation is pending forever. Acceptable for one slice, and
  the timestamp the expiry rule will read is written from the start so B2 is a
  behavior change rather than a migration.
- **The mailer fake could mask a real integration problem** → True, and
  deliberate: this slice proves the flow, slice C proves the transport. The risk
  is that the port's shape turns out wrong under a real provider; keeping the
  port to a single method with an address and a link limits how wrong it can be.
- **Reusing `RegisterHost` couples the two creation paths** → That is the
  point. When slice E removes the open route, the use case stays and only its
  caller disappears.
- **First outbound side effect in the system** → Sending happens after the
  invitation is stored, so a failed send leaves a pending invitation rather than
  a lost one. What an administrator can do about it (see the link, resend) is
  slices B3 and C.

## Migration Plan

One new migration creating the invitation table with a unique index on the
token hash, following `0007_host_pats.sql`. Additive: no existing table
changes, and no existing route changes behavior. Rollback is dropping the table
and the new routes; no other data is touched.

## Open Questions

- Where does the link point? The acceptance page does not exist until slice C,
  so this slice builds the link from a configured base and has nothing to render
  it. The base can stay a constant here and become configuration when a real
  frontend origin is on the other end.
