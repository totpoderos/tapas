## 1. Acceptance spec first

- [x] 1.1 Extend `tests/e2e/host-draft-review.feature` with the scenarios the split introduces: both sections offered under the draft's name, the current one marked, an unsaved edit surviving a move away and back, moving between them not saving, one save storing a change made on each, saving and publishing offered on both, publishing from either, and each section scanned for accessibility and read in Spanish.
- [x] 1.2 Leave every existing scenario in that feature untouched — they stay true of the split, and only their step definitions move.
- [x] 1.3 **Stop and get the user's confirmation on the feature file before writing any implementation.**

## 2. The draft workspace

- [x] 2.1 Add `packages/host-web/src/pages/draft/draft-editor.tsx`: `DraftEditorContext` plus `useDraftEditor()`, holding the loaded draft's edit state and the operations on it (`addPerson`, `removePerson`, `setPartner`, `barPair`, `liftPair`, category add/remove, and the rest) moved verbatim from `review-draft.tsx`, including the load-time symmetrising of barred pairs.
- [x] 2.2 Add `draft-workspace.tsx`: the layout route. Fetches the draft once, renders the loading / missing / error states, owns the single `<form id={FORM_ID}>` wrapping the `<Outlet/>`, portals Save and Publish into the header and the "before publishing" note into the navigation, and renders the publish checklist in the aside beside the outlet.
- [x] 2.3 Keep `buildContent()`, `onSave` and `onPublish` behaviourally identical — same validation (a name is required), same saved acknowledgement, same `PUT`, same `refreshContests()` then navigate to `/contest/:id` on publish, same surfacing of the API's own refusal.
- [x] 2.4 Unit-test the provider directly: an edit made through it is visible to a consumer, and `buildContent()` carries changes from both sections.

## 3. The two sections

- [x] 3.1 Add `draft-rules.tsx`: name, attribution, anti-bias, categories, score range, unique-per-category — fields only, reading and writing through `useDraftEditor()`. Move `Choice` alongside it.
- [x] 3.2 Add `draft-participants.tsx`: the roster with its per-person name, partner select and remove, plus the barred-pairs card and `AddPair` moved down from the aside into this section's main column.
- [x] 3.3 Split `review-draft.module.css` into what the layout keeps (columns, aside, checklist, heading, notes) and what each section needs, without changing any rule.
- [x] 3.4 Delete `pages/review-draft.tsx` once nothing imports it.

## 4. Routing and navigation

- [x] 4.1 In `app.tsx`, make `/review/:id` a layout route rendering `DraftWorkspace`, with an index child for the rules and a `people` child for the participants; keep the `host(...)` guard and the comment explaining why the path is `/review` and not `/drafts`.
- [x] 4.2 In `use-panel-nav.ts`, widen the draft arm to `current: 'rules' | 'people'` and register `/review/:id/people` **ahead of** `/review/:id` in `HOST_ROUTES`, so the shorter pattern does not claim the longer path.
- [x] 4.3 In `sidebar.tsx`, draw two `Way`s in `DraftScope`, each `aria-current="page"` when it is the one the host is on.
- [x] 4.4 Unit-test the navigation: `/review/:id` marks the rules current, `/review/:id/people` marks the participants current and not the rules.

## 5. Language

- [x] 5.1 Replace `shell.reviewDraft` with `shell.draftRules` and `shell.draftParticipants` in `en/shell.json` and `es/shell.json`.
- [x] 5.2 Add each section's own heading and lead to `en/review-draft.json` and `es/review-draft.json`; move existing keys rather than renaming them, so nothing already translated is retranslated.
- [x] 5.3 Confirm no key is left unused and no key is missing from either language.

## 6. Tests and verification

- [x] 6.1 Rework `packages/host-web/tests/unit/review-draft.test.tsx` into the two sections plus the workspace, rendering each section inside the layout so the provider is present; keep every existing assertion, adding the cross-section ones.
- [x] 6.2 Update `tests/e2e/host-draft-review.spec.ts`: step definitions navigate to the section a step is about, both sections get an axe scan, and the Spanish pass checks the two navigation labels.
- [x] 6.3 Full local gate — unit tests for `host-web`, the whole vitest run, typecheck, lint, and the Playwright host suites including `accessibility-reflow`.
- [x] 6.4 `openspec validate the-rules-and-the-people-part-ways --strict`.
- [x] 6.5 Live look: seed a draft, open both sections in the browser, change something on each, save once, confirm both changes stored, then publish and land in the control room.

## 8. The form that starts a contest hands the people over

*Added after review of PR #149: with a section of its own for participants, the create form asking for them too is the same question twice.*

- [x] 8.1 Extend `tests/e2e/host-create-contest.feature` — no participants on the form, Next saves and lands on the people, Save as draft saves and stops, Next refused without a name, the panel names the two steps. **Confirmed with the user before implementing.**
- [x] 8.2 Remove the participants card, its state and its handlers from `new-contest.tsx`; `buildContent()` stops emitting a roster.
- [x] 8.3 Add **Next** beside *Save as draft*: both validate and save, `createDraft`'s returned id routes Next to `/review/:id/people` and Save as draft to `/`.
- [x] 8.4 Rename the sidebar's steps in `NewContestScope` to the two sections' own names, reusing `shell.draftRules` / `shell.draftParticipants`.
- [x] 8.5 Remove the now-unused `newContest.participants*` strings from both languages and add the one for Next; check nothing else reads them.
- [x] 8.6 Move the participant assertions out of `new-contest.test.tsx` and `host-create-contest.spec.ts` — the participants section already covers them — and add the handover ones.
- [x] 8.7 Full local gate again, plus a live look at the form and the handover.

## 7. Landing it

- [x] 7.1 ~~Rebase onto `the-panel-gets-a-modern-shell`~~ — not needed. *That change's code had already shipped to `main`; its two open tasks are a manual accessibility pass and the archive, neither of which touches a file. Branched off `main` directly, so `sidebar.tsx` had no divergence to reconcile.*
- [x] 7.2 Branch, commit and open the PR. *`feat/the-rules-and-the-people-part-ways` → PR #149.*
- [ ] 7.3 Sync the delta spec into `openspec/specs/prepare-a-contest/` and archive the change.
