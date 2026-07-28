## 1. Reproduce it, then close it

- [x] 1.1 Write the regression test first and confirm it before implementing: the session cookie is restricted to secure connections in production and in test, is not so restricted when the environment is explicitly development, and **stays restricted for any other environment value** — asserted against the attributes actually set, for the voter cookie and the host's alike
- [x] 1.2 Watch that test fail against today's unconditional setting — exactly the two development cases failed and the other five passed. Fixing the test's own fixtures first surfaced two things worth knowing: production forces HTTP→HTTPS (`https-redirect.ts`), so a plain request there is answered 301 and never sets a cookie; and publish refuses a lone participant (`JUDGE_CANNOT_SCORE_ANY_DISH`)
- [x] 1.3 Make the transport requirement follow the environment, and let the cross-site marking follow it — the two cannot be set independently, since a cross-site cookie is ignored unless it is also restricted to secure connections
- [x] 1.4 Check the host's sessions carry the same fix, since they are set in the same place and have the same defect

## 2. Saying "you are signed out" instead of "try again"

- [x] 2.1 Tell a refusal-for-being-signed-out apart from any other failure at the point the participant app calls the API
- [x] 2.2 On the dish screen, send a signed-out participant back to joining with an explanation, rather than the message inviting them to retry something that cannot succeed
- [x] 2.3 Do the same on the scoring screen, and when a vote is sent
- [x] 2.4 Keep a genuine save failure reading as one — this must not swallow real errors
- [x] 2.5 Give the new wording its translations in English and Spanish, and cover it with component tests including an accessibility scan

## 3. Making sure one browser is not mistaken for all of them

- [x] 3.1 Add WebKit to the whole-system test matrix
- [x] 3.2 Run the participant journey in WebKit — **21 of 29 scenarios failed on the first run, every one of them this same defect**: the E2E stack declared `NODE_ENV=test`, which keeps the strict flags, while serving over plain HTTP. WebKit dropped the cookie exactly as Safari did, and the snapshots showed the new "You're no longer signed in" screen. Relabelled the stack `development` (which is literally what it is) and all 29 passed
- [x] 3.3 Record what WebKit surfaced — written into design.md's open questions, which the run answered: `test` stays strict and the E2E stack is honestly labelled instead. The predicted crop of unrelated WebKit differences did **not** appear; once the environment was right, all 29 passed first time
- [x] 3.4 Scoped WebKit to the participant journey from the start and said so plainly in the config — not a fallback but the deliberate choice: that app is mobile-first and every iOS browser is WebKit underneath. Full matrix is 116 scenarios in ~1.7 minutes

## 4. Writing it down and verifying

- [x] 4.1 Record in `docs/threat-model.md` why the cookie's transport requirement is conditional, that it fails closed on an unrecognised environment, and that production is unchanged — so the next reader neither tightens it back to unconditional nor loosens it further
- [x] 4.2 Note in the same place that a browser-specific defect reached a real device because the whole-system tests ran one engine — the same "two paths assumed equivalent" shape already recorded there
- [x] 4.3 Run the full verification: unit and acceptance tests, the whole-system tests in both browsers, typecheck, lint, the supply-chain gate, and `openspec validate --strict`
- [x] 4.4 Confirm the original report is fixed — **with one honest limitation: I ran WebKit through Playwright, not Safari.app.** The reported journey ("a cook submits their dish and sees it as theirs") now passes on WebKit, the engine Safari is built on, and a live development API returns `HttpOnly; SameSite=Lax` with **no** `Secure` — the header Safari will keep over http. That is strong evidence, but a confirming click in real Safari is still worth 30 seconds of your time
