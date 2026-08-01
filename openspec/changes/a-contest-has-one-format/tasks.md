Four slices, each an outside-in ATDD loop of its own: the acceptance spec is
rewritten first and left failing, then the units are driven to make it pass. Slices
land in order — a slice's acceptance spec is written against the vocabulary the
previous slice established, so the order is a dependency, not a preference.

The whole change is one breaking rename, so between slices the repo does not compile.
Slices 1–3 are therefore one PR; slice 4 (the followers) may be its own if it is
easier to review that way.

## 1. The domain says it: one format, three values

- [x] 1.1 Rewrite `packages/domain/tests/acceptance/preparing-scoring-rules.feature` in the new vocabulary — one format with three values, a scenario per format for who cooks and who may score, and a scenario for a couples roster with somebody unpartnered. Leave it failing.
- [x] 1.2 Replace `Attribution` and `AntiBias` in `packages/domain/src/model.ts` with `export type ContestFormat = 'solo' | 'solo_with_partners' | 'couples'`; `ContestDraft.attribution`/`.antiBias` become `ContestDraft.format`. Delete `Person.noScoreWith`.
- [x] 1.3 Unit-test then implement dish building per format in `compile.ts`: one dish per person under `solo` and `solo_with_partners`, one dish per couple under `couples`. The mixed roster (a single cooking alone among couples) is gone.
- [x] 1.4 Unit-test then implement exclusion: `isBarred` collapses to the one `solo_with_partners` condition. Delete the `noScore` map, its `link()` helper and the `arbitrary_pairs` branch. Assert in a test that `couples` needs no exclusion beyond "never score your own dish" — the couple's dish already is the partner's.
- [x] 1.5 Add `UNPARTNERED_IN_COUPLES` to `CompileErrorCode` and raise it when `format === 'couples'` and any participant has no `partnerId`. Unit-test it beside the existing `MISSING_PARTNER` / `INCONSISTENT_PARTNER` cases.
- [x] 1.6 Keep `JUDGE_CANNOT_SCORE_ANY_DISH` working: unit-test that a `solo_with_partners` contest of exactly one couple still fails with it, not with the new error.
- [x] 1.7 Update `packages/domain/src/draft/draft-content.ts` and `contest/contest.ts` (the completeness check reads `format` in place of the two fields). Green the acceptance spec from 1.1.

## 2. The API and the store carry it

- [x] 2.1 Rewrite the acceptance features that name the old rules — `publishing-a-contest`, `editing-a-contest-draft`, `managing-a-contest-draft`, `managing-contests-over-the-api`, `reading-my-ballot`, `submitting-a-dish`, `extracting-a-contest-draft`, `merging-a-contest-draft`, `treating-participant-text-as-data`, `scoring-dishes`, `sending-a-vote`, `checking-the-tally` — in the new vocabulary. Add the couples-with-an-unpartnered-participant publish refusal and the couples ballot scenario. Leave them failing.
- [x] 2.2 Write migration `packages/api/migrations/0019_contest_format.sql`: drop `attribution` and `anti_bias`, add nullable `format TEXT`. Comment it as destructive and irreversible, in the style of 0017/0018, and say why nullable (an unset format must report nothing, not be guessed into a rule).
- [x] 2.3 Update the contest/draft DTOs and the persistence mapping in `packages/api/src/db` and `packages/api/src/contests`, including the materialized codec. Reject an unknown format value at the boundary rather than storing it.
- [x] 2.4 Update `packages/api/src/drafts/extraction/contest-draft-tool.ts`: `FIELD_SCHEMAS.format` replaces `attribution` and `antiBias`; drop `noScoreWith` from `PersonSchema`. Keep `.strict()` everywhere.
- [x] 2.5 Update the proposed-draft guard and the participant-text injection defense so `format` is the high-stakes field they protect, and the clarification asks for one field rather than two. Unit-test that an injected name still cannot set it.
- [x] 2.6 Update the publish use case to surface `UNPARTNERED_IN_COUPLES` as its own refusal with its own reason, distinct from the incomplete-draft and nobody-can-score refusals.
- [x] 2.7 Update what listing and reading a contest report — a contest's format in place of its attribution and its anti-bias rule (`the-panel-gets-a-modern-shell`, archived 2026-08-01, added both). Keep reporting it from what was recorded at publish rather than from the compiled view, and keep "does not say" for a contest with no format: where nobody has a partner, `solo` and `solo_with_partners` compile identically, so the format still cannot be read back out of the compiled view. Green slice 2's specs.

## 3. The panel asks one question

- [x] 3.1 Rewrite `packages/host-web/tests/unit/draft-sections.test.tsx` (and the `new-contest` / `people` tests where they touch these fields): one format choice on the rules section, no barred-pairs card, the partner select absent / optional / required per format, and pairings surviving a change of format. Leave failing.
- [x] 3.2 In `draft-rules.tsx`, replace the two `fieldset`s with one `formatLegend` group of three `Choice` cards, each carrying the label and the help sentence from design §5.
- [x] 3.3 In `draft-participants.tsx`, delete the barred-pairs `Card`, the `AddPair` component and the `Callout`. Gate the partner select on the format, and mark a participant as wanting a partner only under `couples`.
- [x] 3.4 In `draft-editor.tsx`, replace `attribution`/`antiBias` state with `format`; drop `barredPairs`, `barPair`, `liftPair` and every `noScoreWith` path. Keep pairings when the format changes.
- [x] 3.5 Update the publish checklist: report participants without a partner only under `couples`; drop the wording that ties it to per-couple attribution.
- [x] 3.6 Rewrite the EN and ES `review-draft.json` and `new-contest.json` keys — add the format legend, the three labels and their help; delete `attributionLegend`, `antiBias*`, `barred*`, `pairOne`, `pairOther`, `pairChoose`, `barPair`, `liftBar`, `noBarredPairs`. Grep every consumer of a deleted key before deleting it (i18next echoes a missing key silently).
- [x] 3.7 Update `contest-control.tsx` and its locale files, where a live contest reports its rules. Green slice 3's tests.

## 4. The followers

- [x] 4.1 Update the shared DTO in `packages/host-web/src/api/client.ts` and `packages/participant-web/src/api`, and whatever in `packages/ui` names the old fields.
- [x] 4.2 Update `packages/mcp/src/tool-catalog.ts` and its contract tests so the tool surface exposes `format` and no barred-pairs argument.
- [ ] 4.3 Update `packages/evals` creation cases (`simple`, `domain`, `adversarial`, `partial-clarify`) and `clarification-match` to the new field. Re-run the eval gate and confirm it still clears its threshold; record the number.
- [x] 4.4 Update the root `tests/e2e` features and specs that set up a contest (`host-create-contest`, `host-draft-review`, `host-rule-space`, `host-contest-progress`, `participant-*`).

## 5. Verify and close

- [ ] 5.1 Repo-wide grep for `attribution`, `antiBias`, `anti_bias`, `arbitrary_pairs`, `per_couple`, `per_person`, `noScoreWith` — every hit outside `openspec/changes/archive` must be gone. A surviving name is a half-applied rename.
- [ ] 5.2 Full check: unit tests, full vitest, typecheck, lint, `openspec validate a-contest-has-one-format --strict`.
- [ ] 5.3 Seed a contest of each of the three formats locally and walk it by hand — host sets it up, participants join, submit, score, results — confirming the ballots exclude exactly what the format says.
- [ ] 5.4 Playwright E2E including the axe-core a11y gate; confirm the format radio group is keyboard-operable and its choices are announced with their help text.
- [ ] 5.5 Sync the delta specs into `openspec/specs/` and archive the change.
