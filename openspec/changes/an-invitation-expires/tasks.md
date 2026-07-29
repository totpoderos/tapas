## 1. Outer loop — the failing acceptance spec

- [x] 1.1 Add the expiry scenarios to `packages/api/tests/acceptance/inviting-a-host.feature`: accepting nearly 24 hours later still works; accepting after the window is refused and creates no account; opening after the window is refused; an expired link is refused identically to an unknown one and names no address
- [x] 1.2 Drive them with `MutableClock` through `makeTestApp`, advancing time rather than waiting — and check the existing `invitationSentTo` support helper, which builds its own app and will need to accept a clock
- [x] 1.3 Add the log scenarios to the security-event-logging feature: a refusal for an expired link is recorded as an expiry, and a refusal for an unknown link is not
- [x] 1.4 Run both features and confirm they fail because nothing expires yet, not because the clock is not reaching the app

## 2. The rule, in the domain

- [x] 2.1 Unit-test the predicate: usable just before the window closes, unusable at the boundary instant, unusable well after
- [x] 2.2 Add the lifetime constant and the expiry judgment to `packages/domain/src/auth/`, beside the account lockout, taking the current time as an argument — the domain has no clock
- [x] 2.3 Export it from the domain index

## 3. One place that decides

- [x] 3.1 Unit-test a single `usabilityOf(invitation, now)` covering all four cases. It takes `StoredInvitation | undefined`, so "unknown" lives inside it too rather than being handled separately by each caller — and it hands the invitation back when usable, which is what lets both use cases narrow without re-checking
- [x] 3.2 Put it beside the generic refusal in `packages/api/src/auth/use-cases/invitation-shared.ts`, so a third condition later has one place to go
- [x] 3.3 Change `OpenInvitation` and `AcceptInvitation` to call it instead of testing `status` themselves; give `OpenInvitation` the clock it now needs
- [x] 3.4 Confirm no code outside that predicate reads `status` to decide whether an invitation can be used

## 4. Telling the log what the caller is not told

- [x] 4.1 Unit-test that the refusal carries enough for the route to distinguish an expiry from an unknown link, while the error returned stays identical
- [x] 4.2 Record the reason on the refused-acceptance event in `packages/api/src/http/invitation-routes.ts`, using the `reason` field the event input already has
- [x] 4.3 Confirm the response body for an expired link is byte-for-byte the response for an unknown one

## 5. Close the loop

- [x] 5.1 Run both acceptance features green
- [x] 5.2 Refactor: meaningful test names, kebab-case files, one class per operation
- [x] 5.3 Re-read the two use cases side by side and confirm they now ask the same question the same way

## 6. Verification

- [x] 6.1 Unit tests for the touched packages
- [x] 6.2 Full `vitest` run across the monorepo
- [x] 6.3 `typecheck` — check the exit code directly, not through a pipe
- [x] 6.4 `lint` — likewise
- [x] 6.5 `openspec validate --strict` for this change
- [x] 6.6 Live smoke test against a running API with `curl`, seeding a fresh and a two-day-old invitation directly (the raw token never reaches the database, so the seed computes the hash itself). Confirmed: the fresh link opens 200, the stale one is refused 404 on both routes with the byte-for-byte unknown-link response, the security log separates `expired` from `unknown`, **the stale invitation is still `pending` afterwards** — proof that expiry is computed rather than written — and no account was created. Same limitation as the previous slice: a *valid* link cannot be obtained out-of-process while the mailer is in memory
