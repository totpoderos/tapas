## 1. Outer loop — the failing component specs

- [x] 1.1 Write the acceptance page's component tests first, under `packages/host-web/tests/unit`: it names the address the invitation was sent to; a strong password finishes and signs in; a weak one is refused on the field and the link still works; an unusable link shows the dead-link message, asks for no password, and names nobody
- [x] 1.2 Write the claim screen's component tests: unclaimed offers an email field; claiming tells them to look in that inbox; a refused address says so without revealing which would have worked; a message that could not be sent shows the link and does **not** say to check the inbox; an already-claimed deployment says so and offers sign-in
- [x] 1.3 Write the test for the one redirect: an anonymous visitor on an unclaimed deployment lands on the claim screen; a signed-in host does not, and makes no extra request to find that out
- [x] 1.4 Write the test for a refused sign-in after a successful acceptance: the account is reported ready and sign-in is offered, and nothing says the acceptance failed
- [x] 1.5 Run them and confirm they fail because the screens do not exist

## 2. The door to the API

- [x] 2.1 Add the three calls to `packages/host-web/src/api/client.ts` — reading an invitation, accepting one, and asking whether the deployment is unclaimed — following the existing shape where a non-ok response becomes an `ApiError` carrying the code
- [x] 2.2 Add `acceptInvitation(token, password)` to `session.tsx` beside `signUp`, accepting and then signing in, so the app keeps one way of arriving at a session
- [x] 2.3 Make the sign-in leg's failure distinguishable from the acceptance leg's — the page has to tell them apart, and only this function sees both

## 3. The acceptance page

- [x] 3.1 Build it from `sign-up.tsx` — the same card, the same split between field-level and form-level errors — with the email field replaced by the address the API reports
- [x] 3.2 Two states from the read on mount: usable, or the dead-link screen. No third state, and no password field on the second
- [x] 3.3 Word the dead-link message with *may*: it may have expired or already been used, ask whoever invited you for a new one. Say nothing that varies by reason, because the API does not tell the page and must not appear to
- [x] 3.4 Handle the account-created-but-sign-in-refused case as its own message pointing at sign-in

## 4. The claim screen

- [x] 4.1 Build the three states on one route: unclaimed, just claimed, already claimed
- [x] 4.2 Show the link when the API reports the message did not go out, and suppress the check-your-inbox line in that case — this is the ordinary first-deploy path, not an error state
- [x] 4.3 Give it no session guard, and comment the route saying why: it asks the API what the deployment is rather than who the visitor is, and wrapping it like its neighbours would break the case it exists for

## 5. Routing

- [x] 5.1 Add both routes to `app.tsx`, each with the house-style comment explaining why it is named clear of the proxied prefixes — `/invites` and `/setup` now forward to the API
- [x] 5.2 Add the one conditional redirect: `/sign-in` to `/claim` when the deployment is unclaimed. Leave the catch-all alone, and leave `/claim` reachable when claimed — two conditions facing each other can disagree while somebody is claiming, and a browser resolves that by looping
- [x] 5.3 Ask whether the deployment is claimed on the anonymous branch of the boot probe `session.tsx` already runs, so a signed-in host makes no extra request

## 6. Words

- [x] 6.1 Add `accept-invite` and `claim` namespaces in English and Spanish
- [x] 6.2 Check every string the two screens render comes through i18n, including the ones in shared `@tapas/ui` components, which need the full key path or the key itself becomes the accessible name

## 7. The journey, in a browser

- [x] 7.1 Write the E2E feature: an administrator invites, the message arrives, the link is opened **in the browser**, a password is chosen, and that person lands on their own contests — the first time this journey runs as a person would take it. Extended the existing enrollment spec rather than adding a file: the suite runs one in-memory API and claiming happens once ever, so a second file that also claimed would race this one for the 201 and file ordering would decide the winner
- [x] 7.2 Read the link from the real message via `tests/e2e/support/mail.ts`, which slice C1 built
- [x] 7.3 Add the dead-link journey: opening an already-used link shows the unusable screen
- [x] 7.4 Add the first-run journey as the **first test in the file**, before anything claims — that state exists only until the first claim, and putting it anywhere else would have made it depend on execution order
- [x] 7.5 Run axe on both screens — it hard-gates the build, and a missing label or an untranslated key surfaces here

## 8. Close the loop

- [x] 8.1 Component specs green (19 new, 1726 across the monorepo). **The E2E was not run**: the Docker daemon is not running on this machine and the suite needs it for the mail catcher. CI is where these three browser journeys first execute
- [ ] 8.2 Keyboard operability and labelling are covered by the axe assertions in the component specs, which pass. **Not done: the manual 200% zoom pass** — it needs a real browser, and this machine cannot run the browser suite. It belongs on the pre-defense checklist rather than being claimed here
- [x] 8.3 Refactor: meaningful test names, kebab-case files. Resist extracting a shared form from sign-up and the acceptance page — E deletes the twin, and abstracting across it now would be abstracting across something about to go

## 9. Verification

- [x] 9.1 Component tests for `host-web`
- [x] 9.2 Full `vitest` run across the monorepo
- [x] 9.3 `typecheck` — exit code checked directly, not through a pipe
- [x] 9.4 `lint` — likewise
- [x] 9.5 `openspec validate --strict` for this change
- [x] 9.6 `npm run test:e2e` — **not run here**, no Docker daemon. Delegated to CI, which is the first place the browser journeys execute
- [ ] 9.7 **Not done** — driving the stack by hand needs the browser and the catcher, neither available on this machine. The delivery-failure screen is covered by a component spec, but its real rendering is unverified until someone runs the stack
