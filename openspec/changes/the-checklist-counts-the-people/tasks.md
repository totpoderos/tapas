## 1. Acceptance spec first

- [x] 1.1 Add the scenarios to `tests/e2e/host-draft-review.feature`: nobody taking part is not ready, one person is not ready and says why, the people are counted once there are enough, and a contest reached from the form that starts it does not claim to be ready.
- [x] 1.2 Leave every existing scenario untouched — a complete contest still reports ready, because it has people.

## 2. The checklist item

- [x] 2.1 Add the people item to `PublishChecklist` in `draft-workspace.tsx`, above the partner item: not ready at 0, not ready at 1 with the reason, ready with a count at 2 or more.
- [x] 2.2 Count the roster as `buildContent()` sends it — unfiltered — so the checklist cannot disagree with what publishing sees.

## 3. Language

- [x] 3.1 Add the three strings to `en/review-draft.json` and `es/review-draft.json`, with the ready one pluralised.
- [x] 3.2 Re-run the key audit: every `t()` literal resolves in both languages, and EN/ES stay symmetric.

## 4. Tests and verification

- [x] 4.1 Unit-test the three states in `draft-sections.test.tsx`, including that a contest with people is still reported ready.
- [x] 4.2 Browser-test the states in `tests/e2e/host-draft-review.spec.ts`, and that landing from the create form's **Next** does not show a green checklist.
- [x] 4.3 Full local gate: whole vitest run, typecheck, lint, and the **full** Playwright suite — not only the suites that look affected.
- [x] 4.4 `openspec validate the-checklist-counts-the-people --strict`.
- [x] 4.5 Live look: create a contest, press Next, and read the checklist on arrival.

## 5. Landing it

- [ ] 5.1 Branch, commit, PR, merge.
- [ ] 5.2 Sync the delta into `openspec/specs/prepare-a-contest/` and archive the change.
