## 1. The host can read their own results (backend)

- [x] 1.1 Write the acceptance feature for a host reading their revealed contest's results — winners by name, joint winners on a tie, withheld before the reveal, refused to a non-owner, refused when not signed in — in domain language only, and confirm it before implementing
- [x] 1.2 Add the host-scoped route that returns the revealed results for a contest the host owns, reusing `toRevealDto` for the body and taking the contest id from the path — `GET /contests/:id/winners`, **not** `/reveal`: that path shape is already taken by the voter's GET and the host's reveal-trigger POST, and Fastify matches on shape, so `:id` and `:contestId` collide (`FST_ERR_DUPLICATED_ROUTE`)
- [x] 1.3 Authorize it by ownership, matching the other host contest operations: 401 when not signed in, 403 for someone else's contest, 404 when there is no such contest
- [x] 1.4 Withhold the results until the contest is revealed, answering the same way the participant reading does
- [x] 1.5 Implement the acceptance feature against a real in-memory database and make it pass
- [x] 1.6 Add the host client call in the host app's api client

## 2. One reveal view, shared

- [x] 2.1 Move the participant reveal view into `@tapas/ui` as a component taking the results as a prop, leaving data-fetching to each app
- [x] 2.2 Keep saffron as an accent only — winner underline and soft tint with dark ink text, never as text colour — and verify the contrast holds in both themes
- [x] 2.3 Keep the entrance animation neutralised under `prefers-reduced-motion`, so the accessibility check has a stable final frame
- [x] 2.4 Give the component its translation keys via full key paths with English defaults, and add the strings to **both** apps in English and Spanish
- [x] 2.5 Point the participant app at the shared component and confirm its existing reveal tests still pass — two needed retargeting: they queried the winner line by the global class `.pt-reveal-winner`, which module-scoped styles necessarily remove. Re-anchored to the accessible structure (the winner is named directly beneath the level-1 heading), which is the real promise and survives the move
- [x] 2.6 Add a component test that renders the shared view against each app's **real** translation resources and asserts the accessible names exactly

## 3. The host's results screen

- [x] 3.1 Add the host results screen at `/results/:id` — clear of the proxied prefixes (`/auth`, `/drafts`, `/contests`, `/assistant`), which a direct load would otherwise send to the API — rendering the shared component from the host-scoped read. It does not poll: the host arrives after revealing
- [x] 3.2 Give it a way in from the control room once the contest is revealed, replacing or extending the existing "the results are out" note
- [x] 3.3 Handle the not-yet-revealed and not-found answers on that screen without showing an empty result as if it were one
- [x] 3.4 Add component tests with an accessibility scan: winners shown, joint winners shown, leaderboard order, and the screen before a reveal

## 4. End to end

- [x] 4.1 Add a whole-system test in which a host closes and reveals a contest and then sees the winners on their own screen, keyboard-operable and accessibility-clean at WCAG 2.1 AA
- [x] 4.2 Extend that test, or an existing one, to assert the host and a participant are shown the same winners in the same order
- [x] 4.3 Run the full verification: unit and acceptance tests, the whole-system tests, typecheck, lint, the supply-chain gate, and `openspec validate --strict`
- [x] 4.4 Mark task 5A.2 of the `tapas-contest-app` change as done, pointing at this change
