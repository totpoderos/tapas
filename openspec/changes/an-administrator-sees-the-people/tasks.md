## 1. Outer loop — the failing specs

- [x] 1.1 Write the API acceptance scenarios first: a signed-in administrator is reported as one, a signed-in host as not one, nobody signed in as nobody — and **asking records no refused administrative attempt**, which is the whole reason this endpoint exists rather than a `403` probe
- [x] 1.2 Write the panel's component tests: one row per address; an account and its accepted invitation are one row; a resent invitation shows only the newest; an administrator is shown as one; invitation rows offer revoke and resend and account rows offer neither
- [x] 1.3 Write the invite form's component tests: inviting adds the person to the list; a message that could not be sent shows the link and the link appears nowhere in the list; an already-registered address is refused on the form
- [x] 1.4 Write the tests for who is offered the way in: an administrator sees the link on home, a host does not
- [x] 1.5 Write the test for a host who reaches the panel: told plainly, left where they are, and no other person's address on the screen
- [x] 1.6 Run them and confirm they fail because none of it exists

## 2. Knowing who is signed in

- [x] 2.1 Add `GET /auth/me` to `packages/api/src/http/auth-routes.ts`, reporting the caller and their role, behind the session check that already exists
- [x] 2.2 Confirm it records nothing in the security log — an ordinary host asking must be silent, or the refused-attempt record stops meaning anything
- [x] 2.3 Replace `hasSession()`'s `GET /drafts` probe with it in `packages/host-web/src/api/client.ts`, and stop fetching a list to discard it
- [x] 2.4 Carry the role on the session in `session.tsx`, for rendering only. Comment that it is not authority: the server reads the account store, because a refresh carries the previous token's claim forward

## 3. The list

- [x] 3.1 Unit-test the join on its own, before any screen: an account beats an invitation to the same address; with no account the newest invitation stands; one address is never two rows
- [x] 3.2 Implement the join where it can be tested without rendering — it is the one piece of real logic in this slice, and the rule is easier to get wrong than it looks
- [x] 3.3 Build the panel at `/people`, with the house-style comment saying why it is not `/admin`: that prefix forwards to the API, as `/invites` and `/setup` do
- [x] 3.4 Show each person's standing, and offer revoke and resend only on rows that are invitations

## 4. Inviting, revoking, resending

- [x] 4.1 Add the invite form with the claim screen's two-outcome shape: sent means a confirmation, not sent means the link shown once and never again
- [x] 4.2 Refuse an already-registered address on the form, from the API's answer
- [x] 4.3 Wire revoke and resend to their rows, reloading the list so it shows what changed
- [x] 4.4 Confirm the link a failed send returned never reaches the list — nothing stores it, and the screen must not appear to be able to show it again

## 5. Getting there

- [x] 5.1 Offer the way in on the home screen, to an administrator only, following the existing link pattern
- [x] 5.2 Add the route, without a role guard in the router — the server decides, and the screen renders what it is told
- [x] 5.3 Show a host who arrives a plain not-allowed screen, and leave them where they are. **No redirect**: the previous slice locked hosts out of a usable screen by redirecting on server state
- [x] 5.4 Confirm the refusal is recorded, and that no other person's address is on the screen

## 6. Words

- [x] 6.1 Add the `people` namespace in English and Spanish
- [x] 6.2 Check every rendered string comes through i18n, including in shared `@tapas/ui` components, which need the full key path or the key becomes the accessible name

## 7. The browser suite grows up

- [x] 7.1 Add a Playwright setup project that claims the deployment once, and make the other projects depend on it. **Keep anything shared out of the setup file itself** — Playwright refuses to let one test file import another, since it would be collected twice, and the setup file is a test file. CI caught this; `npx playwright test --list` catches it locally in seconds, with no browser and no catcher, and is worth running before every push that touches the config
- [x] 7.2 Move the enrollment file's `beforeAll` claim into it, leaving that file to be about enrollment rather than about setup
- [x] 7.3 Keep the unclaimed-deployment journey working — it moved **into the setup project's own assertions**, which is the only place that can see the unclaimed state, since it stops existing the moment that project claims. `claiming-a-deployment.feature` describes it and the setup file says why it lives there
- [x] 7.4 Write the panel's E2E: an administrator invites from the screen, sees the person appear, resends, and revokes
- [x] 7.5 Run axe on the panel — it hard-gates the build

## 8. Close the loop

- [x] 8.1 API acceptance and component specs green (1759 across the monorepo). **The E2E was not run**: no Docker daemon on this machine, and the suite needs it for the mail catcher. CI is where the setup project and the panel journeys first execute — and the setup project changes how *every* browser specification starts, so this run matters more than the last two
- [ ] 8.2 Keyboard operability and labelling are covered by the passing axe assertion, and the table is styled to scroll inside itself rather than push the page sideways. **The manual 200% zoom pass is not done** — it needs a real browser this machine cannot run
- [x] 8.3 Refactor: meaningful test names, kebab-case files, one class per operation

## 9. Verification

- [x] 9.1 Unit and component tests for the touched packages
- [x] 9.2 Full `vitest` run across the monorepo
- [x] 9.3 `typecheck` — exit code checked directly, not through a pipe
- [x] 9.4 `lint` — likewise
- [x] 9.5 `openspec validate --strict` for this change
- [x] 9.6 `npm run test:e2e` — **not run here**, no Docker daemon. Delegated to CI
- [ ] 9.7 **Not done** — driving the stack by hand needs the browser and the catcher, neither available here. Covered by component specs and by the panel E2E, but nobody has watched it
