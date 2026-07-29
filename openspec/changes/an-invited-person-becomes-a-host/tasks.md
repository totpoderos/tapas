## 1. Outer loop — the failing acceptance spec

- [x] 1.1 Write `packages/api/tests/acceptance/inviting-a-host.feature` from the `host-enrollment` spec: an administrator invites; an ordinary host cannot; nobody signed in cannot; an already-registered address cannot be invited; a message reaches the invited address carrying a link; opening the link names the address and does not spend it; accepting creates an ordinary host who can then sign in; the link works only once; unknown and used links refuse identically without naming an address; a weak password is refused and leaves the invitation usable
- [x] 1.2 Add the invitation scenarios to the existing security-event-logging feature: issued, accepted, refused acceptance, and that no entry contains the link
- [x] 1.3 Run both features and confirm they fail for the right reason — no invitation exists yet, not a wiring error

## 2. Storing an invitation

- [x] 2.1 Write the migration creating the invitation table — address, token hash, status, issued-at, accepted-at — with a unique index on the token hash, following `0007_host_pats.sql`
- [x] 2.2 Unit-test the repository: an invitation round-trips, is found by token hash, and is not found by an unknown hash
- [x] 2.3 Implement the repository alongside the other repositories in `packages/api/src/db/`
- [x] 2.4 Confirm the stored row holds only the hash — the raw token exists nowhere in the database

## 3. The mailer port

- [x] 3.1 Unit-test the in-memory mailer: it records what it was asked to send, to which address
- [x] 3.2 Define the port — one method, an address and the link — with `InMemoryMailer` in `src/mail/`, not in test support. It is not a test double standing in for something real: it is the only implementation there is this slice, because the system genuinely cannot send mail yet. A spec reads its `sent` the way a recipient would read their inbox
- [x] 3.3 Wire it into the production dependencies and expose it from the test server, so nothing yet reaches a real mail server

## 4. Inviting

- [x] 4.1 Unit-test the use case: it creates a pending invitation, returns the raw token exactly once, stores only its hash, and refuses an address that already has a host account
- [x] 4.2 Implement the use case as one class, verb-first, alongside the other auth use cases
- [x] 4.3 Add the route to `packages/api/src/http/admin-routes.ts` behind the administrative check from slice A, so refusals for an ordinary host and for nobody signed in come from the step that already handles them
- [x] 4.4 Send the message after the invitation is stored, so a failed send leaves an invitation that exists rather than one that was lost

## 5. Opening the link

- [x] 5.1 Unit-test the use case: a good token reports the invited address; an unknown token and an accepted one are refused identically; nothing about the invitation changes in any case
- [x] 5.2 Implement the use case and the anonymous route, carrying `SENSITIVE_RATE_LIMIT` — it is the route an attacker would use to hunt for valid tokens
- [x] 5.3 Confirm the route is a pure read: no status change, no timestamp written

## 6. Accepting

- [x] 6.1 Unit-test the use case: a strong password creates an ordinary host for the invited address and marks the invitation accepted; a weak password is refused and leaves it pending; an unknown or already-accepted token is refused with the same generic error
- [x] 6.2 Implement the use case, delegating account creation to `RegisterHost` rather than restating the email and password rules
- [x] 6.3 Add the anonymous route with `SENSITIVE_RATE_LIMIT`, returning no session — the caller signs in afterwards through the existing path
- [x] 6.4 Confirm the refusal body names no email address

## 7. Recording the invitation's life

- [x] 7.1 Cover issuing, accepting and a refused acceptance in the security-event-logging feature, asserting the actor where known and the source, and that no entry carries the token
- [x] 7.2 Add the three event types alongside the existing ones and emit them from the **routes**, not the use cases — the source IP is an HTTP fact the use cases have no business knowing, and `auth-routes.ts` already records sign-in events exactly this way
- [x] 7.3 Confirm no log entry contains an invitation link

## 8. Close the loop

- [x] 8.1 Run both acceptance features green
- [x] 8.2 Refactor: one class per operation, meaningful test names, kebab-case files
- [x] 8.3 Check the parallel paths agree — an invited account and a registered account are the same kind of thing to everything downstream (sign-in, lockout, drafts, tokens)

## 9. Verification

- [x] 9.1 Unit tests for the touched packages
- [x] 9.2 Full `vitest` run across the monorepo
- [x] 9.3 `typecheck`
- [x] 9.4 `lint`
- [x] 9.5 `openspec validate --strict` for this change
- [x] 9.6 Live smoke test against a running API with `curl` — **partial, and the reason matters.** Confirmed out-of-process: an administrator invites (201), an ordinary host cannot (403), nobody signed in cannot (401), a taken address is refused (409), an unknown link is refused identically on both routes (404), the stored row holds only a hash, and the security log records issued / refused / the administrative refusal. **The accept leg cannot be smoke-tested from outside the process this slice**: the link exists only in the in-memory mailer, and nothing exposes it over HTTP — by design, since the raw token is deliberately absent from the database. That path is covered by the acceptance suite and becomes externally verifiable in slice C, when Mailpit gives a real inbox to read
