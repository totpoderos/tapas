## 1. Outer loop — the failing acceptance spec

- [x] 1.1 Write `packages/api/tests/acceptance/administrative-access.feature` from the `administrative-access` spec: an administrator sees the host accounts; an ordinary host is refused as not allowed; the refusal reveals no account; nobody signed in is refused as not signed in; an administrator's token is refused administrative work but can still create a draft
- [x] 1.2 Add the security-log scenarios to the existing security-event-logging feature, where the log assertions already live: a refused host is recorded, a refused token is recorded, a successful administrator is not
- [x] 1.3 Add a test-support seam that seeds an administrator — `promoteToAdministrator()` promotes a real registration in the database rather than inserting a synthetic row, so the seeded administrator keeps a real password hash and can sign in. Test support only; no production path to the role in this slice
- [x] 1.4 Run the feature and confirm it fails for the right reason (no administrative work exists yet), not a wiring error — 404 on every administrative scenario

## 2. Session provenance

- [x] 2.1 Unit-test that a session context carries how it was authenticated — cookie session vs. personal access token
- [x] 2.2 Add the provenance field to the session context in `packages/api/src/http/require-host-session.ts`, set on both branches
- [x] 2.3 Remove `role` from the session context rather than keeping it beside provenance — it had no readers anywhere, and a non-authoritative role sitting next to the check is precisely the trap the design warns about. The guarantee is stated in a comment at both branches

## 3. The administrative authorization step

- [x] 3.1 Unit-test the step: an administrator account on a cookie session passes; an ordinary host is refused as not allowed; an administrator account arriving by token is refused as not allowed
- [x] 3.2 Unit-test that the role is read from the account store, not from the session claim — a session whose claim says administrator but whose account no longer is, is refused
- [x] 3.3 Implement the step in `packages/api/src/http/require-administrator.ts`, composed after `requireHostSession` so 401 stays with the existing step and the new one only ever answers 403
- [x] 3.4 Confirm nothing in the step reads `claims.role` for an authorization decision

## 4. Seeing the host accounts

- [x] 4.1 Unit-test the use case: it returns every host account with its email and whether it is an administrator, and returns no password hash, lockout state, or failed-attempt count
- [x] 4.2 Implement the use case as one class, verb-first, alongside the other auth use cases
- [x] 4.3 Add `findById` and `listAll` to `packages/api/src/db/host-account-repository.ts`
- [x] 4.4 Wire the route behind the step from group 3 and register it in the server dependencies

## 5. Recording the refusal

- [x] 5.1 Unit-test that the authorization step emits a refused-administrative-attempt event carrying the actor and source, and emits nothing when the administrator is allowed through
- [x] 5.2 Add the event type alongside `sign_in.*` and `pat.*` and emit it from the step, not from any route, so later administrative routes inherit the logging
- [x] 5.3 Confirm no log entry carries a token or password — the event carries only actor id and source ip

## 6. Close the loop

- [x] 6.1 Run the acceptance feature green
- [x] 6.2 Update `docs/threat-model.md` gap **G3** — the role is now assigned-checkable and enforced, stating plainly that creating an administrator arrives with a later slice so the entry does not read as fully closed
- [x] 6.3 Refactor: one class per operation, meaningful test names, kebab-case files

## 7. Verification

- [x] 7.1 Unit tests for the touched packages
- [x] 7.2 Full `vitest` run across the monorepo — 1352 passed
- [x] 7.3 `typecheck`
- [x] 7.4 `lint`
- [x] 7.5 `openspec validate --strict` for this change
- [x] 7.6 Live smoke test against a running API with `curl`: administrator's cookie session 200 with the list, ordinary host 403, no session 401, administrator's token 403 on administrative work and 201 on a draft. The real security log recorded both refusals with actor and source
