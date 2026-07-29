## 1. Outer loop — the failing acceptance spec

- [x] 1.1 Write `packages/api/tests/acceptance/claiming-a-deployment.feature` from the `admin-bootstrap` spec: the configured address claims an unclaimed deployment; another address is refused and is sent nothing; claiming and accepting makes an administrator who can do administrative work; acceptance grants no session; claiming again sends a fresh link and kills the earlier one; a claimed deployment reports itself claimed and refuses further claims
- [x] 1.2 Add the modified enrollment scenarios: an invitation from an administrator, resent or not, still produces an ordinary host — the requirement B1 wrote as "never an administrator" is now narrower and needs to keep being true
- [x] 1.3 Add the log scenarios: claimed, administrator created, and every refused claim recorded; no entry reveals the configured address
- [x] 1.4 Give the test server a way to set the configured address per app, so a spec can claim with the right one and be refused with the wrong one
- [x] 1.5 Run and confirm the failures are "nothing can claim anything yet", not wiring

## 2. The configured address

- [x] 2.1 Unit-test the environment schema: a valid address is accepted; an invalid one refuses to boot; the committed development default refuses to boot in production but is fine in development
- [x] 2.2 Add `ADMIN_BOOTSTRAP_EMAIL` to `packages/api/src/config/env.ts` with a development default, and add it to the production `superRefine` beside the two secrets already there
- [x] 2.3 Add it to `.env.example` and `docker-compose.prod.yml` with the `${VAR:?set VAR}` treatment the other required settings use

## 3. At most one administrator

- [x] 3.1 Write the migration: the invited role on `host_invitations` defaulting to `'host'`, and a unique partial index on the administrator role in `host_accounts`
- [x] 3.2 Unit-test that the index refuses a second administrator — the guarantee has to be the database's, not a check that a second request can interleave with
- [x] 3.3 Carry the invited role through `StoredInvitation` and the repository

## 4. An account's role comes from its invitation

- [x] 4.1 Unit-test `RegisterHost` with an explicit role, and that it still creates an ordinary host when none is given
- [x] 4.2 Widen `RegisterHost` and have `AcceptInvitation` pass the invitation's role
- [x] 4.3 Unit-test that an ordinary invitation — including a resent one — yields an ordinary host, since this is the widening's main risk

## 5. Claiming

- [x] 5.1 Unit-test the use case: the configured address on an unclaimed deployment issues an invitation for the administrator role; any other address is refused and sends nothing; an already-claimed deployment refuses; claiming again while one is outstanding supersedes it and sends a fresh link
- [x] 5.2 Implement the use case, reusing the invitation-issuing path rather than restating token generation and sending
- [x] 5.3 Unit-test and implement the question "is this deployment unclaimed?"
- [x] 5.4 Add both anonymous routes with `SENSITIVE_RATE_LIMIT`, recording the claim and every refusal
- [x] 5.5 Confirm no refusal names or hints at the configured address

## 6. Close the loop

- [x] 6.1 Run every acceptance feature green
- [x] 6.2 Update `docs/threat-model.md` — **G3 fully closed**: the role is assigned by a real path now, not only enforced. Say what the bootstrap does and does not protect against
- [x] 6.3 Note in the threat model that a lost sole administrator has no recovery path today, so it is recorded rather than discovered
- [x] 6.4 Refactor: one class per operation, meaningful test names, kebab-case files

## 7. Verification

- [x] 7.1 Unit tests for the touched packages
- [x] 7.2 Full `vitest` run across the monorepo
- [x] 7.3 `typecheck` — exit code checked directly, not through a pipe
- [x] 7.4 `lint` — likewise
- [x] 7.5 `openspec validate --strict` for this change
- [x] 7.6 Live smoke test against a running API with `curl`. **The task's claim that this slice needs no seeding was wrong**: the claim *gate* is fully exercisable from outside, but the link still exists only in the in-memory mailer, so accepting needs a seeded token hash exactly as before — that limitation ends with Mailpit, not with this slice. Confirmed end to end: reports itself unclaimed; the wrong address gets 403 `CLAIM_REFUSED`; the configured address gets 201 and an invitation whose `invited_role` is `admin`; accepting creates the administrator; that administrator reaches `/admin/hosts`; the deployment then reports itself claimed and refuses a second claim with 409 `SETUP_COMPLETE`. The log carries refused/claimed/completed/refused with reasons `wrong_address` and `already_claimed`, and never contains the configured address. A hand-written second administrator is refused by the database: `UNIQUE constraint failed: host_accounts.role`
