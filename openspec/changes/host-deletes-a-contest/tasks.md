## 1. A host can delete a contest (backend)

- [x] 1.1 Write the acceptance feature for a host deleting a contest — at each stage of its life, with everything held about it destroyed, refused to a non-owner, refused when not signed in, and refused a second time — in domain language only, and confirm it before implementing
- [x] 1.2 Add the delete methods the destruction needs: contest, roster, dishes, vote sessions and their scores, and the audit entries for a contest — the first delete paths on those repositories
- [x] 1.3 Add a unit-of-work collaborator so the whole destruction runs in one transaction, following the `BEGIN`/`COMMIT`/`ROLLBACK` shape already used by the migration runner
- [x] 1.4 Write the delete use case: resolve the id to a draft **or** a published contest, refuse when it is neither, destroy everything held about it, and record the tombstone — one entry naming the actor, the time, the path and the confirmation, and carrying no contents
- [x] 1.5 Add the host-scoped delete route covering drafts and contests alike, authorized by ownership: 401 when not signed in, 403 for someone else's, 404 when there is no such contest
- [x] 1.6 Require the contest's name on the request once anyone has claimed a place or cast a vote, and refuse the delete when it does not match — enforced in the API so no entry point can route around it
- [x] 1.7 Retire `DELETE /drafts/:id` into the new route and absorb `DiscardDraft` — nothing in either app or the tool catalog called it, but two acceptance specs did, and both are migrated. `DiscardDraft` is deleted rather than left dangling: it recorded `before: content`, i.e. discarding a draft *copied* every participant name into the log. The confirmed `managing-a-contest-draft` scenario was amended accordingly (user-approved: one rule for drafts and contests alike)
- [x] 1.8 Implement the acceptance feature against a real in-memory database and make it pass, including that the freed join code no longer reaches the contest
- [x] 1.9 Cover the tombstone's exact shape: the prior history is gone, one entry remains, it carries no before/after, and no participant or dish name appears anywhere in the row — asserted against the real audit_log table, since after a deletion there is deliberately no API that can read it back

## 2. Telling a participant the contest is gone

- [x] 2.1 Answer `410` with a distinct deleted code on the voter-scoped routes when a tombstone exists for the id, and `404` otherwise — keeping the host's reading at `404`, since a deleted contest has no owner left to recognise
- [x] 2.2 Cover the boundary in the acceptance feature: a participant cannot send a vote into a deleted contest, and no vote is recorded
- [ ] 2.3 Handle the deleted answer in the participant app on the dish, scoring and waiting screens — say plainly that the contest is gone and stop polling
- [ ] 2.4 Give those screens their translations in English and Spanish, and add component tests with an accessibility scan

## 3. Deleting from the host app

- [ ] 3.1 Move `ConfirmDialog` out of `contest-control.tsx` into `@tapas/ui`, keeping close and reveal working through it unchanged, and confirm their existing tests still pass
- [ ] 3.2 Add the typed-name mode to the dialog: a labelled input inside the focus trap, the action held until it matches, and the mismatch announced — sequenced so it does not collide with the component move in `host-sees-the-results`
- [ ] 3.3 Give the dialog its translation keys via full key paths with English defaults, and add the strings to both apps in English and Spanish
- [ ] 3.4 Add the delete action to the contest list and to the control room, choosing the plain or typed-name confirmation by whether anyone has taken part
- [ ] 3.5 Add the client call, and on success return the host to their contest list with the deletion announced
- [ ] 3.6 Add component tests with an accessibility scan: the plain confirmation, the typed-name confirmation, a wrong name deleting nothing, backing out, and the keyboard path through the dialog

## 4. Deleting through the assistant

- [ ] 4.1 Add the `delete_contest` tool to the catalog, destructive and confirmation-gated, carrying the contest's name so the issued token is bound to it
- [ ] 4.2 Add the contract tests: refused without an approval, carried out with one, a token for one contest not validating another, and another host's contest refused
- [ ] 4.3 Check the assistant path end to end against the MCP path — the same validation, the same guard, the same recorded confirmation — since a check holding on one path and not the other is the failure shape recorded in `docs/threat-model.md` §4
- [ ] 4.4 Rate-limit it as the destructive tools require

## 5. Writing it down and verifying

- [ ] 5.1 Write the audit exception into `docs/threat-model.md`: why deleting a contest reduces the log, why the tombstone is what survives, and the replayable-token limitation it inherits
- [ ] 5.2 Add a whole-system test in which a host deletes a running contest people have joined, typing its name, and a participant scoring in another browser context is told it is gone — keyboard-operable and accessibility-clean at WCAG 2.1 AA
- [ ] 5.3 Run the full verification: unit and acceptance tests, the whole-system tests, typecheck, lint, the supply-chain gate, and `openspec validate --strict`
- [ ] 5.4 Smoke-test it live against the running stack: delete a draft, and delete a live contest with a claimed place, checking the tombstone is the only entry left
