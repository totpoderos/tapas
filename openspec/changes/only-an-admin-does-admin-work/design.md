## Context

`HostRole = 'host' | 'admin'` has existed since the first slice
(`packages/domain/src/auth/host-account.ts:4`) and `host_accounts.role` is
already a column that `rehydrate` reads back. Nothing produces `'admin'` and
nothing checks for it. `docs/threat-model.md:424` carries this as gap **G3**.

Two existing behaviors shape this design more than anything else:

- **Session claims carry the role, and refresh perpetuates them.**
  `authenticate-host.ts:56` issues a session with `role: account.role`, and
  `refresh-session.ts:27` re-issues from `claims.role` — the old token's claim,
  never a fresh read of the account. A role carried in claims therefore
  survives every refresh indefinitely.
- **The token path pins the role.** `require-host-session.ts:43` sets
  `role: 'host'` for personal-access-token requests, regardless of the owning
  account. Today that is incidental; this change makes it load-bearing.

Authorization in this codebase is normally *ownership* ("is this your
contest?"), with role playing no part. Administrative work is the first place
where role is the whole check, so it needs its own deliberate shape rather than
an extension of the ownership pattern.

## Goals / Non-Goals

**Goals:**

- A single authorization step that reserves work to administrators, composable
  onto any route the later enrollment slices add.
- A refusal that distinguishes "not signed in" from "signed in, not allowed"
  (401 vs 403).
- A personal access token that can never reach administrative work, expressed
  as a stated guarantee rather than an accident of one line.
- One observable administrative capability to test all of this against, chosen
  so it is useful later rather than thrown away.
- The refusal recorded in the security log from one place, so no future
  administrative route can forget to record it.

**Non-Goals:**

- Any way to *become* an administrator. Nothing in this slice assigns the role;
  `HostAccount.register()` keeps hardcoding `'host'`. Bootstrapping is slice D.
- Invitations, enrollment, revocation, resending — slices B1–B3.
- Any frontend. The admin panel is slice C.
- A general role framework. There is one privileged role and one check; a
  `requireRole(...)` factory generalises a case that does not exist yet.

## Decisions

### The account store is the authority on role, not the session claim

The check reads the role from the host account at request time rather than
trusting `claims.role`.

The alternative — trusting the claim — is cheaper by one indexed lookup but
wrong in a way that matters: because `refresh-session.ts:27` copies the role
forward from the previous token rather than re-reading the account, an
administrator who is demoted keeps administrative claims across every
subsequent refresh, forever. Demotion would silently never take effect. For the
one role that can create host accounts, that is not an acceptable failure mode.

The cost is one lookup on administrative requests only, which are rare by
nature. The claim stays in the token — it is still useful for deciding what the
frontend renders — but it is explicitly not the authorization source. Anything
that reads `claims.role` to decide access is a bug.

### The session context records how it was authenticated

Because the check now reads the account, pinning `role: 'host'` on the token
path (`require-host-session.ts:43`) would no longer be enough — the lookup
would find the real `'admin'` role behind an administrator's token and let it
through.

So the session context gains a provenance field (cookie session vs. personal
access token) and the administrative check requires **both** an administrator
account **and** a cookie-borne session. Authorization stops depending on a
field that quietly lies about the role, and starts depending on two facts that
are each true.

The alternative — keeping the pinned `'host'` and continuing to authorize off
the session's role field — was rejected because it encodes a security
guarantee as a value that looks like a bug to the next reader, which is exactly
how it would get "fixed."

### Administrative work is composed, not replaced

The new step runs *after* `requireHostSession`, not instead of it. Not signed
in is still refused by the existing step as not signed in (401); the new step
only ever sees an authenticated request and only ever answers "not allowed"
(403). The two refusals in the spec fall out of the composition rather than
needing to be coordinated.

### Seeing the host accounts is the observable

The slice needs one administrative action to exist for any of this to be
testable, and a probe route existing only for tests would be dead weight.
Listing host accounts is the smallest genuinely useful choice: the admin panel
in slice C needs exactly this list, and it does not overlap with the invitation
behavior of slices B1–B3.

The list returns email and whether the account is an administrator. It must not
return password hashes, lockout state, or failed-attempt counts — that is
account-security state, and an administrator has no need for it.

### The refusal is logged by the authorization step

The security event is emitted where the refusal is decided, not by each route.
This follows the project's existing stance that audit coverage must not depend
on remembering to call something (the audit log is a projection for the same
reason). Every administrative route added by later slices then gets its
privilege-escalation logging for free.

### Administrators exist only in test fixtures for now

Since nothing assigns the role, acceptance tests seed an administrator directly
through the repository, which `HostAccount.rehydrate()` already supports. This
seam stays in test support and does not ship a production path to the role —
slice D owns that.

## Risks / Trade-offs

- **An extra account lookup on every administrative request** → Confined to
  administrative routes, which are inherently low-traffic. The correctness win
  on demotion is worth more than the query.
- **A later change could re-authorize from `claims.role`** → The spec states
  the token guarantee, and the acceptance scenario "an administrator's token
  cannot do administrative work" fails loudly if anyone does. This is the same
  class of parallel-path drift the codebase has been bitten by before: cookie
  path and token path diverging in one layer.
- **The role claim now exists but is not authoritative** → Two sources for one
  fact is a comprehension hazard. Mitigated by naming it in the code comment at
  the point of issuance, and by never reading it in an authorization decision.
- **Test-only admin seeding could drift into production** → It lives in test
  support only. Slice D replaces it with a real, gated path and is the next
  change after the enrollment slices need an administrator to exist.
- **G3 closes only partly until later slices land** → An administrator can be
  checked for but not created. The threat-model entry should say so plainly
  rather than reading as fully closed after this change alone.

## Migration Plan

No database migration: `host_accounts.role` already exists and already
round-trips through `rehydrate`. No existing route changes behavior, so the
change is additive and deployable on its own. Rollback is removing the new
route and step; no data is written by this slice.

## Open Questions

- Does the host-account list need pagination? Not for a single-operator
  deployment with a handful of hosts; revisit if the admin panel in slice C
  ever faces a long list.
