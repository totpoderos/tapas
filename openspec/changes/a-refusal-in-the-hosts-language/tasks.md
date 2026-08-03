Two sub-slices, each its own ATDD loop and PR. A must land first: B has nothing
to translate until a refusal carries its facts.

## 1. Sub-slice A — a refusal carries the facts it is about

- [x] 1.1 Write the acceptance scenarios from `specs/validate-and-publish-contest/spec.md` as a `.feature` in `packages/api/tests/acceptance`, alongside the publish rejections already there — domain language only. **Confirm the feature with the user before implementing.** — its own file rather than more scenarios on `publishing-a-contest`, which is about what may go live; this is about what a refusal says. Confirmed. Gotcha for next time: a Feature's free-text narrative must not begin a line with a Gherkin keyword — a sentence starting "When a contest cannot go live…" was parsed as a step and the whole file registered zero tests.
- [x] 1.2 Unit tests in `packages/domain`: each of the ten refusals carries the values its sentence names, under stable keys. Red first. Include the two that carry nothing, so "no details" is a decision rather than an omission. — eleven tests; the seven that needed details went red first, the two "carries nothing" ones passed throughout as they should.
- [x] 1.3 Add `details` to `CompileError` and `PublishError` and fill it at every `fail(...)` site. The message text is unchanged except where 1.4 changes it. — `RefusalDetails` exported from the domain barrel; keys are `person`, `first`/`second`, `min`/`max`, `unsaid`.
- [x] 1.4 `DUPLICATE_PERSON_ID` names the two people instead of quoting an id — sentence and details both. Its unit test asserts no id appears, mirroring the category one. — the first fixture used `'same'` as the id, which the new sentence legitimately contains, so `not.toContain` would have passed for the wrong reason; the id is now `'p3f7a'`, which spells nothing.
- [x] 1.5 Carry `details` through the API error body and the assistant turn's refusal path. Check both: the publish routes send `{ error }` wholesale, but `refusalMessage` reads only `message`. — exactly that asymmetry: the routes needed nothing, the turn needed `refusalOf`. `refusalMessage` stays, delegating, so its callers are untouched; the `failed` step gains optional `code` and `details`.
- [x] 1.6 Verify: unit + full vitest + typecheck + lint + `openspec validate --all --strict`. PR.

## 2. Sub-slice B — the panel says it in the host's language

- [ ] 2.1 Write the acceptance scenarios from `specs/internationalization/spec.md` — a refusal read in Spanish, its people still named as written, and an unworded reason still readable. **Confirm the feature with the user before implementing.**
- [ ] 2.2 Component test on the rules form: a refusal renders in the chosen language, and interpolates the names it was given. Red first.
- [ ] 2.3 Component test on the chat panel: the same refusal, the same words. This repo's recurring bug is two equivalent paths diverging, and these two are as equivalent as they come.
- [ ] 2.4 Component test for the fallback: a code the screen has no wording for renders the API's sentence, never a key. Assert the absence of `publishReason` in the output — a key on screen is the failure this is guarding.
- [ ] 2.5 Implement the helper (code + details → sentence) and use it from both surfaces. `ApiError` gains `details`.
- [ ] 2.6 EN and ES wording for all ten codes. Names and categories are interpolated, never translated. `INCOMPLETE_DRAFT` joins its gaps with `Intl.ListFormat` `disjunction` — reuse `chat.needs.*` rather than writing the three gap phrases a second time.
- [ ] 2.7 Test that every `PublishErrorCode` has a key in both languages. The existing `translations-say-the-same-things` guard catches a key in one language only; it cannot catch a code nobody wrote a key for.
- [ ] 2.8 Verify, including reading both surfaces in Spanish in the browser against the local database. PR.

## 3. Close out

- [ ] 3.1 `openspec sync-specs`, then archive.
- [ ] 3.2 Note what was left: refusals outside publishing still arrive in English, and the mechanism for them is now in place.
