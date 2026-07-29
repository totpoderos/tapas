## 1. Outer loop — the failing acceptance spec

- [x] 1.1 Add the failed-handoff scenarios to `packages/api/tests/acceptance/inviting-a-host.feature`: the invitation stands and is pending; the administrator is told the message did not go out; inviting is not refused; the link is offered in that answer; a successful handoff offers no link; the stored invitation still does not contain it
- [x] 1.2 Add the recording scenarios: a handed-off message and one that could not be handed off are each recorded as such, and resending records the new message's own outcome
- [x] 1.3 Add the claim scenarios to `claiming-a-deployment.feature`: a claim whose message cannot be handed off still stands, offers the link, is not reported as refused, and the link from that answer can be accepted with
- [x] 1.4 Add the log scenarios: a failed handoff is recorded, a successful one is not noise, and no entry contains the link
- [x] 1.5 Give the in-memory mailer a way to be told to fail, so the acceptance specs can drive the failure path without a transport — it is the only implementation those specs ever see
- [x] 1.6 Run and confirm the failures are "nothing reports a handoff outcome yet", not wiring

## 2. A failed send stops being an exception

- [x] 2.1 Unit-test `InviteHost` with a mailer that throws: the invitation is inserted, the result is successful, and it reports that the message did not go out and carries the link
- [x] 2.2 Unit-test that a mailer which succeeds reports so and carries no link
- [x] 2.3 Guard the send in `invite-host.ts` and make the outcome part of what inviting returns — the comment there already claims this behaviour, so this is the code catching up with it
- [x] 2.4 Confirm `resend-invitation.ts` and `claim-deployment.ts` inherit it, since both go through `InviteHost`; neither should need logic of its own

## 3. Recording what happened

- [x] 3.1 Write the migration adding the handoff outcome to `host_invitations`, nullable — existing rows were sent by a mailer that could not fail and must not be given a history they do not have
- [x] 3.2 Unit-test the repository round-trip for both outcomes and for the untouched null
- [x] 3.3 Carry it through `StoredInvitation` and the repository, named for handoff and never for delivery
- [x] 3.4 Check the whole change for the word "delivered" and remove it wherever it stands for something only handoff is known about

## 4. The routes

- [x] 4.1 Unit-test that the invite route returns the link when handoff failed and omits it otherwise, and that neither shape leaks it into the log
- [x] 4.2 Return the outcome and, on failure, the link from `POST /admin/invites` and from the resend and claim routes
- [x] 4.3 Record the failed-handoff security event, and confirm no event carries the link
- [x] 4.4 Confirm the response for a successful handoff is unchanged from what C2 and C3 will already have been written against

## 5. The transport

- [x] 5.1 Add the SMTP implementation behind the existing one-method port, leaving `InMemoryMailer` exactly as it is
- [x] 5.2 Unit-test what can be tested without a server: that configuration is read correctly and that a transport error surfaces as a failed handoff rather than an exception
- [x] 5.3 Add the mail settings to `packages/api/src/config/env.ts` with development defaults pointing at a local catcher, and add them to the production `superRefine` beside the signing key and the administrator address
- [x] 5.4 Unit-test that production refuses to boot without mail configured and that development does not
- [x] 5.5 Choose the transport by configuration in `composition.ts` — in-memory only where the API process is the test

## 6. A whole-system test that reads a real message

- [x] 6.1 Add the catcher to `docker-compose.yml` for the demo
- [x] 6.2 Have Playwright's `webServer` start it, so a local run and CI start it the same way and cannot drift; leave `.github/workflows/ci.yml` alone, which is the point of doing it there
- [x] 6.2b Add `/admin`, `/invites` and `/setup` to host-web's dev proxy. **Found by CI, not by me** — the E2E reaches the API through that proxy and its allowlist had never gained the prefixes four slices of API work added, so `POST /setup/admin` came back 404. The explore notes had named this exact trap; naming it did not wire it. Every prefix there is now a page route that cannot exist, which is why the acceptance page is `/accept-invite` and the first-run screen must not be `/setup`
- [x] 6.3 Add a helper that clears the catcher before a spec and reads the newest message, polling with a short timeout rather than sleeping
- [x] 6.4 Write the end-to-end feature — **but not as this task described it.** The link cannot be *followed in a browser* here: the page it points at is C2's. The feature instead proves what this slice actually claims — a real message carries a real, working link — by following it over HTTP, and finishes in the browser with a sign-in, so the account it created is shown to be real. The first time this flow runs outside the API process without a seeded token hash
- [x] 6.5 Note the new prerequisite in the README and in `tests/e2e/README.md`

## 7. Close the loop

- [x] 7.1 Run every acceptance feature green. **The end-to-end suite was not run**: the Docker daemon is not running on this machine and the suite now needs it for the mail catcher. Nothing in the E2E can be claimed to pass here — CI is the first place it will actually run
- [x] 7.2 Re-read `InviteHost`'s comment against its code and confirm they now say the same thing
- [x] 7.3 Refactor: one class per operation, meaningful test names, kebab-case files

## 8. Verification

- [x] 8.1 Unit tests for the touched packages
- [x] 8.2 Full `vitest` run across the monorepo
- [x] 8.3 `typecheck` — exit code checked directly, not through a pipe
- [x] 8.4 `lint` — likewise
- [x] 8.5 `npm run audit:ci` — a new dependency crosses the supply-chain gate for the first time in this series
- [x] 8.6 `openspec validate --strict` for this change
- [x] 8.7 Live smoke test against a running API with `curl` and a real SMTP server. **Docker was not running on this machine, so Mailpit could not be used**; a minimal SMTP sink stood in, which proves the same thing that matters here — that `SmtpMailer` speaks SMTP and a message crosses a socket. Confirmed: claim → message on the wire with the right From/To/Subject → link extracted from the message → accepted → administrator reaches `/admin/hosts`; invite with the server alive gives `messageSent: true` and no link; **invite with the server dead gives 201, `messageSent: false` and the link** — the case that was a 500 before this slice. Stored: `message_sent` 1/1/0 across the three; the log carries `invitation.not_sent` once; no link appears in the log or the invitations. The seeded-token-hash workaround is retired. **The Mailpit path itself is unverified on this machine and needs a run with Docker up**
