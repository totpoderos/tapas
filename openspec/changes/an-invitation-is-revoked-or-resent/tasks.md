## 1. Outer loop — the failing acceptance spec

- [x] 1.1 Add the listing scenarios to `packages/api/tests/acceptance/inviting-a-host.feature`: an administrator sees the invitations with address and standing; one past its window shows as expired; no link appears; an ordinary host is refused
- [x] 1.2 Add the revoking scenarios: a revoked link neither accepts nor opens; an accepted invitation cannot be revoked; an invitation cannot be revoked twice
- [x] 1.3 Add the resending scenarios: a new message with a different link; the new link works; the original dies at that moment; the new invitation gets its own full window; an expired one can be resent; a revoked, accepted or superseded one cannot
- [x] 1.4 Add the scenarios that a revoked and a superseded link are refused byte-for-byte like an unknown one and name no address — the whole point of the five reasons
- [x] 1.5 Add the log scenarios to the security-event-logging feature: revoked and resent are recorded against the administrator; neither record contains a link; a refusal for a revoked link is recorded as a revocation and for a superseded one as superseded
- [x] 1.6 Run both features and confirm they fail because nothing revokes or resends yet

## 2. Recording the two new endings

- [x] 2.1 Write the migration adding `revoked_at` and `superseded_by` to `host_invitations`, both nullable
- [x] 2.2 Unit-test the repository: an invitation can be marked revoked and marked superseded, each round-tripping with its moment and, for a supersede, the id that replaced it
- [x] 2.3 Widen `InvitationStatus` to `'pending' | 'accepted' | 'revoked' | 'superseded'` and add the two repository writes
- [x] 2.4 Add a read that lists every invitation, ordered by when it was issued

## 3. The predicate takes its third and fourth reasons

- [x] 3.1 Unit-test `usabilityOf` for revoked and superseded, and that each reports its own reason rather than being folded into another
- [x] 3.2 Extend `UnusableReason` and `usabilityOf` in `invitation-shared.ts` — and change nothing in `OpenInvitation` or `AcceptInvitation`, which is the whole point of having built it there
- [x] 3.3 Confirm the two anonymous use cases needed no edit; if either did, the predicate is in the wrong place — **neither was touched.** `usabilityOf` gained two branches and `OpenInvitation` and `AcceptInvitation` are byte-identical to how B2 left them. That was the bet made when the predicate was extracted, and it paid

## 4. Listing the invitations

- [x] 4.1 Unit-test the use case: it reports each invitation's address, standing and issued-at; it shows a stored-pending but out-of-time invitation as expired; it reveals no token or hash
- [x] 4.2 Implement the use case, deriving the displayed standing from `usabilityOf` rather than comparing timestamps afresh — a second opinion about expiry is exactly the drift to avoid
- [x] 4.3 Add the route to `admin-routes.ts` behind the administrative check

## 5. Revoking

- [x] 5.1 Unit-test the use case: a usable invitation is revoked and stops being usable; an accepted, already-revoked, superseded or expired one is refused because there is nothing to revoke
- [x] 5.2 Implement the use case, named by invitation id — no administrative route takes or returns a token
- [x] 5.3 Add the route behind the administrative check, recording the revocation against the administrator

## 6. Resending

- [x] 6.1 Unit-test the use case: it issues a new invitation to the same address with a different token and a fresh window, marks the original superseded and points it at the replacement, and sends the new link
- [x] 6.2 Unit-test what cannot be resent: accepted, revoked and superseded are refused; expired is allowed — time can be undone, decisions cannot
- [x] 6.3 Implement the use case, reusing the invitation-issuing path rather than restating token generation and sending
- [x] 6.4 Add the route behind the administrative check, recording the resend against the administrator

## 7. Telling the log the two new reasons

- [x] 7.1 Add the `invitation.revoked` and `invitation.resent` event types
- [x] 7.2 Confirm the refused-acceptance event now carries `revoked` and `superseded` as reasons, with no change needed at the route — it already records whatever reason the use case returns
- [x] 7.3 Confirm no event carries a link or token

## 8. Close the loop

- [x] 8.1 Run both acceptance features green
- [x] 8.2 Assert the five refusals are byte-identical to each other, not merely each equal to the unknown one — the feature keeps the pairwise scenarios a spec reader wants, and `tests/integration/invitation-refusals-are-indistinguishable.test.ts` pins the consequence: one status, one body, no address, across all five
- [x] 8.3 Refactor: one class per operation, meaningful test names, kebab-case files

## 9. Verification

- [x] 9.1 Unit tests for the touched packages
- [x] 9.2 Full `vitest` run across the monorepo
- [x] 9.3 `typecheck` — exit code checked directly, not through a pipe
- [x] 9.4 `lint` — likewise
- [x] 9.5 `openspec validate --strict` for this change
- [x] 9.6 Live smoke test against a running API with `curl`. Confirmed: revoke 200 then 409 `NOTHING_TO_REVOKE`; resending a revoked invitation 409 `INVITATION_FINISHED`; resend 201 then 409 on the original; the listing shows `revoked`, `superseded` and `pending`; the stored chain has `superseded_by` pointing at the replacement and `revoked_at` set only on the revoked one; the log carries `invitation.revoked` and `invitation.resent`. A *valid* link still cannot be obtained out-of-process while the mailer is in memory, so the accept-side refusals stay covered by the suites
