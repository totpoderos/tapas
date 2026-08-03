Three sub-slices, each its own ATDD loop and its own PR. The order matters: the
publish guard (A) is the safety net, so it lands before the change that makes
ids easier to leave out; the identity fix (B) is the API and the forms together,
because either half alone leaves the bug in place.

## 1. Sub-slice A — a draft whose categories are one thing cannot be published

- [x] 1.1 Write the acceptance scenarios from `specs/validate-and-publish-contest/spec.md` as a `.feature` in `packages/api/tests/acceptance`, alongside the existing publish rejections — domain language only, no `categoryId`. **Confirm the feature with the user before implementing.** — added to `publishing-a-contest.feature`, borrowing the phrasing the participant sibling already uses ("told apart"). Confirmed.
- [x] 1.2 Unit test in `packages/domain`: `compile` refuses two categories sharing an id, and accepts two distinct ones. Red first. — three tests; the two refusal ones went red first, the acceptance one passed throughout as it should.
- [x] 1.3 Add `DUPLICATE_CATEGORY_ID` to `CompileErrorCode` and the check to `compile`, beside `DUPLICATE_PERSON_ID` so the two read as the pair they are.
- [x] 1.4 Map the new code to a status in the publish route the way the other rule-space rejections are mapped (422, not 400 — it is understood but unpublishable). — nothing to write: `PublishFailureCode` is `'DRAFT_NOT_FOUND' | PublishErrorCode` and `PublishErrorCode` is `'INCOMPLETE_DRAFT' | CompileErrorCode`, so `publishErrorStatus` already answers 422 for anything that is not a missing draft. The union carried it.
- [x] 1.5 ~~Host-facing message in EN and ES~~ — **the premise was wrong.** There is no code→message map anywhere; `draft-workspace.tsx` shows `t('reviewDraft.publishError', { reason })` with the reason being the API's message verbatim, and that message comes from the domain in English. No publish rejection is translated today — all eight compile codes are equally English. Adding an i18n path for this one code alone would make it the odd one out. So: the domain message is written for a host to read and act on, and translating publish rejections stays a separate question for all of them at once. Noted in 4.2.
- [x] 1.6 Verify: unit + full vitest + typecheck + lint + `openspec validate --all --strict`. PR.

## 2. Sub-slice B — a category's id is the API's to assign and nobody's to overwrite

- [x] 2.1 ~~Write the acceptance scenarios from `specs/prepare-a-contest/spec.md` as a `.feature`~~ — **withdrawn at the confirmation point, and the delta spec with it.** A category's id is inert inside a draft: the only readers anywhere are saving a score and gathering a tally, both after publish. So the requirement has no domain-level observable and cannot be written as a scenario without naming the id (forbidden) or asserting nothing. The invariant is real and is held at unit, component and integration level instead. See design.md, "A category's identity has no domain-level observable" — which also records two corrections to the proposal's reasoning: the forms were never a collision source, and they were *laundering* model-supplied duplicates, which this sub-slice stops.
- [x] 2.2 Unit test `withCategoryIds`: assigns to a category without an id, preserves one that has it, leaves a draft with no scoring alone. Mirror `withParticipantIds`'s tests. — on `CreateDraft`, where the assignment is observable; red first.
- [x] 2.3 Implement `withCategoryIds` in `packages/api/src/drafts/use-cases/shared.ts`, beside `withParticipantIds`, with the comment saying why identity is not the author's to state. — plus `withAssignedIds`, so a write path cannot apply one and forget the other.
- [x] 2.4 Apply it in `CreateDraft` and `UpdateDraft`. Check there is no third draft-write path — grep for `drafts.insert` and `drafts.update` rather than trusting the two. — three writes exist; `RenameDraft` is the third and carries existing content through untouched, so it needs nothing.
- [x] 2.5 Component test: `draft-editor` carries a loaded category's own id through a save instead of re-deriving `c{i+1}` from the row's position. Note the row key (`freshId()`) and the category id are different things and must stay so. — three tests, red first: a save unchanged, a category added, a category removed.
- [x] 2.6 Fix `draft-editor.tsx` (keep the loaded id) and `new-contest.tsx` (send names, let the API assign). Both currently build `c${i+1}`. — `ScoringConfig.categories[].id` is now optional on the wire; one existing test that pinned `c1`/`c2` was rewritten to say what the shape now means.
- [x] 2.7 Verify. — the manual pass was **not** run as written: the local `.env` points `DATABASE_URL` at the production Neon database, so driving the running app by hand would have written test drafts into it. Covered instead by an integration test over the real HTTP route with real repositories against in-memory SQLite (`a-category-keeps-its-identity.test.ts`), sending the exact payloads both forms now send — which is the seam the manual pass was there to check. PR.

## 3. Sub-slice C — the assistant is not asked for an id it cannot know

- [ ] 3.1 Write the two new scenarios from `specs/assistant-tool-surface/spec.md` — a whole contest in one asking, and categories with no id stated — as acceptance scenarios in `packages/mcp/tests/acceptance`. **Confirm the feature with the user before implementing.**
- [ ] 3.2 Unit test in `packages/mcp`: `create_draft` accepts a category with no id, and the JSON schema advertised to the model no longer requires one. Assert the schema, not just the parse — the schema is what the model reads.
- [ ] 3.3 Make `id` optional on the category shape in `tool-catalog.ts`, carrying across the reasoning `personShape` already states.
- [ ] 3.4 Add a host-assistant eval case: a whole contest set up in one message, asserting two distinct categories result. The eval set has no case that reaches this today.
- [ ] 3.5 Run the eval against the real model and record the trajectory. Not a gate — threshold-gated on its own track.
- [ ] 3.6 Verify: unit + full vitest + typecheck + lint + a live smoke test of the reported one-shot prompt. PR.

## 4. Close out

- [ ] 4.1 `openspec sync-specs` to fold the three delta specs into `openspec/specs/`, then archive the change.
- [ ] 4.2 Note in the archive what was deliberately left: existing drafts keep their `c1`/`c2` ids, category *names* are still not unique on the form, and no publish rejection is translated — the domain writes them all in English and the panel shows them verbatim (found in 1.5; worth its own change for all eight codes at once).
