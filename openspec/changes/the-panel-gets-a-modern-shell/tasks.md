Eleven sub-slices, A–K. Each is one ATDD loop and one PR: write the acceptance
`.feature` first and confirm it, then the inner unit loop, then the slice
verification (unit + full vitest + typecheck + lint + `openspec validate` + a
live smoke check) before opening the PR.

## 1. Slice A — the shell, and the contest list on it

- [x] 1.1 Write `tests/e2e/host-panel-shell.feature`: the navigation is present on every host screen, absent on sign-in, marks where you are, skips past itself to the surface, counts nothing as none, and reads in Spanish. Confirm it before implementing.
- [x] 1.2 Add the token-level pieces to `@tapas/ui` with unit tests: `StatePill`, `DataTable`, `Callout`, `EmptyState` — full `common.*` i18n key paths, both themes, no hard-coded colour. `ProgressBar`, `StatTile` and `Card` are **deferred to the slices that use them** (B and C) rather than added here with no consumer.
- [x] 1.3 Build `host-web/src/shell/`: `PanelShell` (sidebar + top bar + surface region), `Sidebar`, `TopBar`, and `usePanelNav()` deriving scope, current item and breadcrumb from the route and session. Each surface keeps its own `<main id="main">`, so there is still one landmark per screen and the skip link still lands past the navigation.
- [x] 1.4 Add `ContestsProvider` (one `listContests()` fetch, `{state, refresh}`) inside the host navigation only; wire `App` so every authenticated route renders inside `PanelShell`.
- [x] 1.4a Pick the whole navigation by role: administrative for `role === 'admin'`, host otherwise, with neither kind's items appearing in the other. Resolve `/` per role, and send an administrator asking for a host surface to the people. Unit-test both directions.
- [x] 1.4b Keep the shared list truthful: `useDeleteContest` and the control room's close/reveal re-read it, and arriving at the contest list re-reads it whatever changed it. Found by the browser suite — a contest deleted from the control room stayed on the list, and a published draft came back still marked a draft.
- [x] 1.5 Add the `shell` i18n namespace in EN and ES; move the state words to `common.contestState.*` so the sidebar, the header and the table say them identically; check no key echoes as an accessible name.
- [x] 1.6 Re-compose `Home` onto the shell as the design's contest table (name + status pill + updated + row actions), with the empty, loading and error states as drawn. "Updated" reads as "2 minutes ago" via `Intl`, following the interface language.
- [x] 1.7 Sidebar: deployment scope with per-status counts derived from the provider, each count also narrowing the list by that state; `aria-current="page"`; `<nav aria-label>`; 44px targets; keyboard-only pass.
- [x] 1.8 Collapse the sidebar to a disclosure below the tablet breakpoint; keep `accessibility-reflow` green.
- [x] 1.9 Unit tests for `usePanelNav()` scoping and for the shell's landmarks; update the host-web unit tests the removed per-page chrome touched.
- [x] 1.9a Update `tests/e2e/host-people-panel.spec.ts`: its `signIn()` helper asserts the "Your contests" heading for the administrator and then clicks a People link from the contest list. Under the split an administrator lands on the people directly — the expectation changes because the behaviour changed by decision, and the host path in the same file must keep asserting the plain refusal.
- [x] 1.9b Write `tests/e2e/host-panel-shell.spec.ts` implementing the feature in a real browser, and follow the contest list's change from a list to a table through the four other specs that asserted `listitem` on it.
- [x] 1.10 Slice verification, then PR.

## 2. Slice B — the contest list says how each contest is going

- [x] 2.1 Write `tests/e2e/host-contest-progress.feature` (progress, rules in brief, join code, a draft reporting none). Confirm it before implementing.
- [x] 2.2 Migration `0017_contest_attribution.sql`: nullable `attribution` on the contest row; written at publish from the draft. **The backfill is dropped** — reading it out of the old `materialized` JSON needs engine-specific JSON functions, which would put SQLite-only SQL in a migration that has to keep the Postgres swap a swap. `NULL` already means "does not say", which the list handles for unset drafts anyway, so an old row reports none rather than a guess (design.md revised).
- [x] 2.3 Add batched counts: `countsByContest(ids)` on the roster repository and a grouped status count on the vote-session repository — plain `IN (...) GROUP BY`, short-circuiting an empty id list. Integration tests against in-memory SQLite.
- [x] 2.4 Widen `ContestSummary` with `attribution`, `categoryCount`, `joinCode`, `progress`; every field optional, `null` for a draft. Extend `ListMyContests` with the two repositories; unit-test that a draft reports none rather than zeroes.
- [x] 2.5 Assert in a test that listing N contests issues a bounded number of queries, not one per contest.
- [x] 2.6 Update the MCP contest-list tool and its contract test to the widened DTO. The tool is a pure pass-through, so the description is what changed — including that a draft's absent progress means voting has not started, not that nobody voted, since an assistant confusing the two would tell the host something untrue.
- [x] 2.7 Widen `host-web/src/api/client.ts` and render the design's row: `ProgressBar` (added to `@tapas/ui`) + "13 of 18 votes sent", and the subtitle "Per person · 4 categories · code 4KQ-207", each part omitted when the field is absent. A live contest nobody has joined says so instead of drawing an empty bar; a draft says "not published"; a revealed one says its results are public.
- [x] 2.8 Slice verification, then PR. The reflow suite caught a latent slice-A bug the wider table exposed: the visually-hidden actions heading is absolutely positioned, and with no positioned ancestor it escaped the table's scroll container and stretched the page to 562px at a 375px viewport. `DataTable` now establishes a containing block, and the name column has a floor so a narrow screen scrolls the table instead of breaking names one word per line.

## 3. Slice C — the control room on the shell

- [x] 3.1 Write `tests/e2e/host-control-room.feature` (contest-scoped navigation, join code, progress, close/reveal confirmations). Confirm it before implementing.
- [x] 3.1a **Spec gaps found while grounding**, both now delta'd and validated: the tally reports how many places the roster holds (`manage-live-contest`), and reading one's own contest reports the rules it is played by including anti-bias (`contest-management-api`).
- [x] 3.1b API groundwork: migration `0018_contest_anti_bias.sql` (nullable, written at publish, no backfill — same reasoning as 0017, and more urgent since `allowedVoters` cannot tell barring couples from barring chosen pairs); `antiBias` on the contest row; `placeCount` on the tally. Publishing requires both rules, so a null column only ever comes from an older row — tested at the repository, where a null can actually be written, and asserted never to read as `'none'`.
- [x] 3.2 Contest-scoped sidebar — landed in slice A and unchanged here; verified live against the re-composed surface.
- [x] 3.3 Top bar: breadcrumb, state pill, and the live-tally indicator (shown only on a live contest's control room, where something is actually being re-read). Narrow screens revealed the reservation for the fixed language/theme controls was on the wrong row — they sit beside the disclosure there, not the crumbs — which had squeezed the contest and surface names to nothing between their separators.
- [x] 3.4 Re-compose `contest-control.tsx`: join code panel with Copy, the three stat tiles, the two-tone bar with its legend, Drive-the-contest, Recent activity, Rules in force, Danger zone. Its own brand bar, title, state pill and activity-log link are gone — the three duplicates behind every CI scoping fix so far, so those workarounds were removed rather than left as dead defensiveness. `Card` and `StatTile` added to `@tapas/ui`; a titled `Card` is a named region, since a `<section>` without a name is not a region at all. The audit event/source vocabulary moved to `contests/audit-event` so the log and the control room cannot drift apart.
- [x] 3.5 Close and reveal confirmations kept on `ConfirmDialog`; revealing is drawn while the contest is live but `disabled`, so a host can see what comes next and the keyboard cannot reach a button that would refuse.
- [x] 3.6 EN/ES for every new string, including the anti-bias wording and on/off in `common`. Unit tests moved off the name and state pill the surface no longer owns — asserting them here would be testing the shell through a page that does not draw them, which is how the duplicate-name flakes got in.
- [x] 3.7 Slice verification, then PR. Run file-by-file as well as whole (slice B's lesson): `host-live-controls` failed alone with two stale control-room assertions the whole-suite order had hidden.

## 4. Slice D — the join code can be scanned

- [x] 4.1 Write `tests/e2e/host-join-code-scannable.feature` (a scannable code is offered for a live contest, not for a draft, and the code stays readable beside it). Confirm it before implementing.
- [x] 4.2 Add **`qrcode-generator`** — not `qrcode`, which drags in `pngjs`, `dijkstrajs` and `yargs@^15` (a CLI arg parser, for its `bin`) behind a browser bundle. `qrcode-generator` has zero dependencies, is MIT, ships its own types, and is the original implementation most others descend from. Pinned, lockfile committed, `npm run audit:ci` clean (design.md revised).
- [x] 4.3 Render the join code as an inline SVG built from `isDark(row, col)` — **not** `createSvgTag()`, which hardcodes `fill="white"` and would be wrong in the dark theme — in a disclosure beside Copy code, with `aria-expanded` and able to be hidden again. Encodes the join code text only; `role="img"` with a translated accessible name naming the code; sized in relative units so it survives 200% zoom.
- [x] 4.4 Unit tests: nothing shown until asked for, `aria-expanded` following, hideable again, absent once revealed (no join code to scan), an accessible name naming the code, the quiet border present, and — the one that matters — the painted module grid matching an **independently recomputed** encoding of the join code, so it fails if the component ever encodes anything else. A snapshot would only have said "same as last time".
- [x] 4.5 Slice verification, then PR. **The live check earned this slice**: in the dark theme the code rendered inverted — light modules on dark — which the QR standard does not assume and many scanners refuse. The plate is now deliberately not theme-aware, the one place in the app that isn't, and the feature and both tests say "stays dark-on-light" rather than "contrasts with what is behind it". No test would have caught it; the assertion I had written would have passed.

## 5. Slice E — the rule space on the shell

- [ ] 5.1 Write `tests/e2e/host-rule-space.feature` (the step navigation, and that only a name is required to save). Confirm it before implementing.
- [ ] 5.2 Sidebar in new-contest scope: the four numbered steps with the current one marked, and the "only a name is required" note.
- [ ] 5.3 Re-compose `new-contest.tsx` on the design: attribution and anti-bias as radio cards, the category chips with add/remove, the score-range segmented control with lowest/highest, and the unique-per-category checkbox.
- [ ] 5.4 Top bar: breadcrumb, Cancel, Save as draft.
- [ ] 5.5 EN/ES; keep the existing new-contest unit tests green.
- [ ] 5.6 Slice verification, then PR.

## 6. Slice F — draft review on the shell

- [ ] 6.1 Write `tests/e2e/host-draft-review.feature` (the before-publishing warning, and publishing from the shell). Confirm it before implementing.
- [ ] 6.2 Draft-scoped sidebar: the draft card, Rules and Participants & pairing, Activity log, and the "Before publishing" callout counting participants without a partner.
- [ ] 6.3 Re-compose `review-draft.tsx`: the participants & pairing grid with partner selects and Remove, the unpartnered row marked as needing one, the add-participant row, the can't-score-each-other pairs, and the publish checklist.
- [ ] 6.4 Top bar: breadcrumb, draft pill, saved indicator, Save changes, Publish.
- [ ] 6.5 EN/ES; keep the existing review-draft unit tests green.
- [ ] 6.6 Slice verification, then PR.

## 7. Slice G — the activity log on the shell

- [ ] 7.1 Write `tests/e2e/host-activity-log-panel.feature` (filtering by source, and that each row names how it was triggered). Confirm it before implementing.
- [ ] 7.2 Re-compose `audit-log.tsx` as the design's table (event, source, actor, when) with the source-filter chips (all / in-app / connected tool / system) as a real radio group.
- [ ] 7.3 Mark the host-confirmed entries as the design does; keep source conveyed by wording, not colour alone.
- [ ] 7.4 EN/ES; keep the existing audit-log unit tests green.
- [ ] 7.5 Slice verification, then PR.

## 8. Slice H — the activity log leaves as a file

- [ ] 8.1 Write `tests/e2e/host-activity-log-export.feature` (the file carries what the screen shows, is named after its contest, and is refused for another host's contest). Confirm it before implementing.
- [ ] 8.2 Add a CSV writer next to the audit projection with unit tests for the escaping rules: quote fields containing a comma, quote or newline; double embedded quotes; prefix a leading `=`, `+`, `-`, `@`, tab or CR with an apostrophe.
- [ ] 8.3 Add `?format=csv` to `GET /contests/:id/audit`, returning `text/csv` and a `Content-Disposition` filename from the contest name, reusing the route's ownership check; integration tests for the 403 and 401 paths.
- [ ] 8.4 Host-web: Export CSV in the log's top bar, fetched with credentials and saved via a blob URL, with the refusal rendered in the panel.
- [ ] 8.5 EN/ES; slice verification, then PR.

## 9. Slice I — people & access on the shell

- [ ] 9.1 Write `tests/e2e/host-people-panel-shell.feature` (an administrator's panel is administration only; a host sees no administrative group and is still told plainly at the screen). Confirm it before implementing.
- [ ] 9.2 The administrative navigation: the people, sign out, theme and language, and nothing of host work — absent, not disabled. No contest list is fetched for it.
- [ ] 9.3 Re-compose `people.tsx`: the person/standing/actions table with a pill per standing (administrator, host, invited, expired, revoked), Resend and Revoke, the invite-a-host panel, and the shown-once link callout.
- [ ] 9.4 Unit test that a host's render contains no way to the people anywhere in the shell, and that reaching the screen anyway still shows the plain refusal.
- [ ] 9.5 EN/ES; slice verification, then PR.

## 10. Slice J — the assistant on the shell

- [ ] 10.1 Write `tests/e2e/host-assistant-panel.feature` (the conversation on the shell, and confirming a destructive action). Confirm it before implementing.
- [ ] 10.2 Re-compose `chat.tsx` on the design: the connected-tool header with Clear conversation, the asymmetric message bubbles, the confirmation card, and the carried-out-action note.
- [ ] 10.3 Keep the composer at 44px and 16px input, keep the existing aria-live announcements, and keep the double-send guard.
- [ ] 10.4 EN/ES; keep the existing chat and clear-conversation unit tests green.
- [ ] 10.5 Slice verification, then PR.

## 11. Slice K — the results on the shell

- [ ] 11.1 Write `tests/e2e/host-results-panel.feature` (the results on the shell, reachable from the contest-scoped navigation once revealed). Confirm it before implementing.
- [ ] 11.2 Re-compose `results.tsx` / `RevealView` on the design: the winner block, best-in-each-category rows, and the leaderboard with the leader emphasised — no flashing on reveal, rank conveyed by number as well as by emphasis.
- [ ] 11.3 Enable the Results way-in in the contest-scoped sidebar once the contest is revealed.
- [ ] 11.4 EN/ES; keep the existing results and reveal-view unit tests green.
- [ ] 11.5 Slice verification, then PR.

## 12. Close the change

- [ ] 12.1 Full sweep: every host-web and ui unit test, the whole vitest run, typecheck, lint, the full Playwright suite with axe-core, `npm audit`.
- [ ] 12.2 Manual pass: keyboard-only through all eight surfaces, screen-reader on the shell, 200% zoom, both themes, EN and ES.
- [ ] 12.3 `openspec validate the-panel-gets-a-modern-shell --strict`, then sync the specs and archive the change.
