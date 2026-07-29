## 1. Outer loop — the failing specs

- [x] 1.1 Add the acceptance scenarios to `packages/api/tests/acceptance/host-authentication.feature`: nobody can create an account for themselves, however they ask
- [x] 1.2 Add the component test that the host app offers a way to sign in and no way to create an account
- [x] 1.3 Add the end-to-end assertion that the sign-up address leads nowhere — somebody will have it bookmarked
- [x] 1.4 Run them and confirm they fail because registration is still open

## 2. The two ways a test gets a host

- [x] 2.1 Add the fixture to `packages/api/tests/support/test-server.ts`. **It takes the app, not the database** — the helpers that create hosts hold an app, and threading a second argument through twenty-odd helpers and every call site produced about ninety type errors before I reverted it. A `WeakMap` from app to database, populated by `makeTestApp`, made the whole migration a one-line substitution per site. `seedHostIn(db, …)` is the primitive underneath, for the MCP harness, which builds its own app. Idempotent: registering twice used to be a harmless refusal specs ignored, and a fixture should not be stricter than what it replaced
- [x] 2.2 Unit-test the seeder itself once — a seeded host signs in through the ordinary path, or every spec that leans on it is built on a guess
- [x] 2.3 Add `hostInvitedBy(email, password)` to `tests/e2e/support` — **no `baseURL` argument**, which was the first shape and put the call out of scope in every module-level helper. It reads the app's address from the config, as the mail helper already does
- [x] 2.4 Confirm the helper reads its link from the message rather than the database, as the enrollment specs do

## 3. Migrating the specs that only need a host to exist

- [x] 3.1 Move the 22 API acceptance specs to `seedHost`. Their `Given a signed-in host` steps keep their words; only what happens underneath changes
- [x] 3.2 Move `packages/mcp/tests/support/api-harness.ts` the same way
- [x] 3.3 Move the 17 end-to-end files to `hostInvitedBy`
- [x] 3.4 Leave the enrollment specs alone — they are about how a host comes to exist, and must keep doing it the long way
- [x] 3.5 Run the whole suite before deleting anything, so a failure here is a migration failure and not a removal failure

## 4. Closing the door

- [x] 4.1 Remove `POST /auth/register` from `packages/api/src/http/auth-routes.ts`, and the error-status map it needed
- [x] 4.2 Leave `register-host.ts` and its unit tests exactly as they are — `AcceptInvitation` calls it, and the rules never belonged to the route
- [x] 4.3 Remove `client.register`, `session.signUp`, the `/sign-up` route, `sign-up.tsx`, its component test, and `sign-up.json` in both languages
- [x] 4.4 Remove the sign-up references from the remaining sign-in copy — the "already have an account?" line has nothing to point at any more
- [x] 4.5 Delete the sign-up journey from `tests/e2e/host-authentication.spec.ts`, keeping the sign-in ones. The unclaimed-deployment ground those specs once covered belongs to the setup project now

## 5. Saying what is now true

- [x] 5.1 Sharpen **G10** in `docs/threat-model.md`: until this slice a lost administrator still left an open endpoint as a way to make some account, and after it a deployment is reachable only through its database
- [x] 5.2 Check the threat model for anything else that assumed open registration — the principals list, the A07 row, and the G3 narrative all discuss how accounts come to exist
- [x] 5.3 True up `docs/accessibility.md`: drop the sign-up row, add `/accept-invite`, `/claim` and `/people`, and split the table so that axe (hard-gated in CI, passing) is not confused with Lighthouse (needs a browser). **A missing score should read as a stated gap, not an empty cell**
- [x] 5.4 Check the README and `docs/infra-generation.md` for anything describing how a host account is made

## 6. Close the loop

- [x] 6.1 Run every suite green
- [x] 6.2 Search the tree for `auth/register`, `signUp` and `sign-up` and confirm what remains is deliberate. **The grep missed one**: `host-language.spec.ts` navigated through the sign-up link to prove a chosen language survives navigation and a reload, and its strings are Spanish — "Crea una cuenta de anfitrión" matches none of those terms. CI found it. It now navigates to the claim screen, which is the only anonymous page left
- [x] 6.3 Read the diff for tests that were migrated but no longer make sense — a spec whose only interesting step was registering is a spec to delete, not to port

## 7. Verification

- [x] 7.1 Unit and component tests for the touched packages
- [x] 7.2 Full `vitest` run across the monorepo
- [x] 7.3 `typecheck` — exit code checked directly, not through a pipe
- [x] 7.4 `lint` — likewise
- [x] 7.5 `npx playwright test --list` — validates config and collection in seconds, with no browser and no catcher. Run it before pushing
- [x] 7.6 `openspec validate --strict` for this change
- [x] 7.7 `npm run test:e2e` — **not run here**, no Docker daemon. `npx playwright test --list` collects 134 tests in 22 files, which caught two real breakages this slice: an import inserted into the middle of a multi-line import, and a wrong relative depth. CI is where the browser journeys run
- [x] 7.8 Live smoke test against a running API with `curl`. `POST /auth/register` returns **404 Route not found**. The only remaining path runs end to end: claim a fresh deployment (201, mail down so the link comes back), accept with that link, sign in as the new administrator (role `admin`), reach `/admin/hosts`
