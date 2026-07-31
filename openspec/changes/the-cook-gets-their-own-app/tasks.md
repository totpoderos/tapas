# Tasks

Seven slices, A–G, each one ATDD loop and one PR. Every slice writes its `.feature` first and gets it confirmed before any implementation, and every slice ends on the same verification: unit tests, the full vitest run, typecheck, lint, `openspec validate`, and a live smoke test against a running app.

**Blocked on `the-reveal-is-ready-to-be-restyled`.** That change forks the reveal into two copies and puts a rendered-screen test under the same-results promise. Slice G restyles the copy it leaves behind; the rest of the slices do not touch the reveal and need not wait.

## 1. Slice A — the surface

The two flattest screens, chosen first: 13 and 14 carry no glass, no accent and one button each. If the participant-owns-its-own-tokens decision is wrong, this is where it is cheap to find out.

- [x] 1.1 Write the acceptance feature for `participant-app-shell`: the app is drawn from its own definitions, is shown in one light appearance whatever the device asks for, offers no appearance control, carries the same header everywhere, and holds the 320px reflow and reduced-motion floor. Confirm it before implementing.
- [x] 1.2 Give `participant-web` its own token sheet — the vermouth roles, the sheet and its wash, the glass surface, Source Serif 4, the pill and panel radii, the accent-tinted shadows — and stop importing `@tapas/ui/tokens.css`.
- [x] 1.3 Pin the document to the light appearance. Removing `ThemeToggle` is not enough on its own: `tokens.css` flips under `prefers-color-scheme: dark` unless the light theme is set explicitly, and an unpinned app on a dark phone would take a ramp this design has no values for.
- [x] 1.4 Remove `ThemeToggle` and `initTheme()` from `main.tsx`. Confirm `theme-toggle.spec.ts` still passes — it drives the host app's sign-in screen, so it should be untouched. If it is not, stop: something else depends on this.
- [x] 1.5 Build the header bar and the participant-local `LanguageSelect` replacement (the EN/ES segmented control the design puts in the header, not the shared component's shape).
- [x] 1.6 Restyle `ways-onward.tsx` to the pinned foot: top rule, 16px padding, 15px links.
- [x] 1.7 Draw screens 13 (contest deleted) and 14 (session lost) — flat `#f6f2ec`, no glass, no accent, one way out each. These are the states where the only touchable thing should be the exit.
- [x] 1.8 Add `@phosphor-icons/react`, importing per icon rather than from the barrel. Record the built bundle size before the rest of the icons arrive in later slices, so the growth has a baseline. **Baseline: 327.47 kB raw / 103.85 kB gzip with two icons; 320.81 / 101.58 with none — so 6.66 kB raw, 2.27 kB gzip for the pair.** Tree-shaking works despite the build transforming 3197 modules; the untransformed count is not the shipped one. At ~3.3 kB per icon, the handoff's eleven should land near 36 kB raw / 12 kB gzip. Re-measure at 8.3.
- [x] 1.9 EN and ES resources for every new string in this slice.
- [x] 1.10 Run the slice verification. Typecheck clean, lint clean, vitest 1949/1949, Playwright 275/275 (Chromium + WebKit), `openspec validate` passing, and the screens driven live at 390px and 320px.
- [ ] 1.11 **Bundle Source Serif 4, self-hosted.** The handoff sets everything in it and this repo ships no webfont, so `--serif` currently lists it first and renders the Georgia fallback — a different face at a similar colour. Nothing external may be fetched (no CDN), so this means committing a subset or taking `@fontsource-variable/source-serif-4`, and it needs its own bundle-size measurement against 1.8's baseline. Left out of this slice because a webfont on a phone at a venue is a decision of its own, not a token value.

## 2. Slice B — join

- [x] 2.1 Write the acceptance feature for the widened `enroll-participants`: the whole roster comes back for a valid code, a taken place is shown as taken and is not claimable, a contest with no place left still names its roster, and an unknown code is still refused. Confirm it before implementing.
- [x] 2.2 Widen the join-code lookup to return every place with its state, in the API. Keep claiming refused for a taken place — the roster widens, the rule does not.
- [x] 2.3 Check whether the MCP surface mirrors this read, and follow it if so. **Checked: there is no mirror.** The MCP tools are host-scoped (contests, drafts, participants, tally, results); the places lookup is voter-scoped by join code and has no MCP equivalent. Nothing to keep in step.
- [x] 2.4 Draw screen 1 (join by code) — the dish-count numeral, the glass field panel, the primary action.
- [x] 2.5 Draw screen 2 (code not recognised): the message moves from the banner above the title down onto the field itself, and the numeral becomes a neutral "?".
- [x] 2.6 Draw screen 3 (choose your place): 68px glass rows for open places; a taken place stays in the list, dimmed, dashed and tagged, and is not a button.
- [x] 2.7 Draw screen 4 (all places taken): the full roster as plain rows and a way out, replacing today's single muted line.
- [x] 2.8 Keep the 409 behaviour: a place claimed between loading and choosing refreshes the list and then says so.
- [x] 2.9 EN and ES resources for every new string in this slice.
- [x] 2.10 Run the slice verification. Typecheck clean, lint clean, vitest 1956/1956, Playwright 280/280 (Chromium + WebKit), `openspec validate` passing, and all four screens driven live against a seeded five-place contest at 390px and 320px.

## 3. Slice C — your dish

- [x] 3.1 Write the acceptance feature for the dish screens, if the existing coverage does not already carry these observables. **Checked, and two things were new**: the "n of five in" count (the dishes read carried no expected total), and a confirmation that had never been translated — `Saved — your dish is in.` was a bare English string in an app promising full EN/ES. Two scenarios added; the rest of the coverage stands.
- [x] 3.2 Draw screen 5 (your dish, empty): the form in one glass panel, the roster below, the ways onward pinned to the foot.
- [x] 3.3 Draw screen 6 (dish saved): the saved line inside the panel, the amber "yours" tag on the participant's own row, the action becoming "Update dish".
- [x] 3.4 EN and ES resources for every new string in this slice.
- [x] 3.5 Run the slice verification. Typecheck clean, lint clean, vitest 1949/1949, Playwright 280/280 (Chromium + WebKit), `openspec validate` passing, both screens driven live in English and Spanish at 390px and 320px.
- [x] 3.6 Route the score and ranking specs through the ways onward. Removing the dish screen's separate "Score the dishes →" link — the handoff gives screen 5 only the quiet ways-onward links — broke ten locators across three e2e specs. The navigation promise is unchanged and `participant-navigation` guards it independently.

## 4. Slice D — scoring

The largest slice, and the one carrying the accessibility risk of the whole change.

- [x] 4.1 Write the acceptance feature for the added `taste-and-score` requirements: one dish at a time with the dish in the address, a score chosen as one value from the allowed range and operable by keyboard alone, an unscored category saying so in words, and only an allowed value ever recorded. Confirm it before implementing.
- [x] 4.2 Put the dish in the route rather than in component state. Screen 8's link to a missing score has to reach a specific dish and category, and the back control has to go to the previous dish rather than out of the app; both are free with a route param and both need inventing without one.
- [x] 4.3 Build the score track as a radio group first — `role="radiogroup"`, one input per step, arrow keys, Home/End — and confirm it is fully operable before any pointer handling exists. This ordering is the point: the keyboard path is the control, and the drag is an addition to it.
- [x] 4.4 Layer pointer and touch on top: down anywhere on the track selects the nearest step, dragging updates a transient local value that snaps, release commits through the existing optimistic `save()` with its rollback. The committed value stays the saved one.
- [x] 4.5 Handle the wide-range case: above roughly twelve steps, drop the per-step labels and keep the ends. `ballot.range` is host-configurable and has no upper bound worth trusting.
- [x] 4.6 Handle the narrow-viewport case: below 360px, drop to end labels regardless. Ten labels across a 320px column is the specific thing the reflow test will catch.
- [x] 4.7 Draw the progress rail — it reflects dishes fully scored, not individual values — and the unscored-category treatment: amber outline **and** the words "your turn".
- [x] 4.8 Write the acceptance feature for the ballot review: the whole ballot readable before sending, the missing dish and category named, and the way to them offered. Confirm it before implementing.
- [x] 4.9 Draw screen 8 (the ballot before sending), including the disabled send and the amber link that jumps to the missing dish with that category ready.
- [x] 4.10 Re-dress `RankingInputs` to the new sheet. Its interaction does not change and no new control is designed, but it no longer inherits a re-tint for free now that the app owns its tokens — a strict-ranking contest must not look like the old app.
- [~] 4.11 Manual pass, **partly done**. Keyboard verified by hand in a real browser: arrow keys move a step, Home/End jump to the ends, focus follows a drag, and the ballot's "missing" link lands with the named category focused. 320px verified. **A screen-reader pass has NOT been done and cannot be faked** — it needs a person with VoiceOver or NVDA, and it is the half of this task that matters most, because the track is a radio group wearing a slider and the announcement is the thing nobody can infer from the markup. Left open deliberately rather than ticked.
- [x] 4.12 EN and ES resources for every new string in this slice.
- [x] 4.13 Run the slice verification. Typecheck clean, lint clean, vitest 1962/1962, Playwright 292/292 (Chromium + WebKit), `openspec validate` passing, and both screens driven live in Spanish at 390px and 320px including a real drag.

## 5. Slice E — sending

- [ ] 5.1 Write the acceptance feature for the confirmation: declining leaves the ballot alone, the keyboard stays within it while open, and it can be dismissed from the keyboard. Confirm it before implementing.
- [ ] 5.2 Draw screen 9 (confirm send) as a focus-trapped bottom sheet in thumb reach, over the blurred ballot. Both actions are its own; nothing else dismisses it.
- [ ] 5.3 Write the acceptance feature for the modified "A participant can tell that their vote is already in": what they gave is shown per dish rather than one row per score.
- [ ] 5.4 Draw screen 10 (vote sent) with the per-dish totals. Check how the total is derived against how the reveal derives its own — if the tally weights categories and this screen sums them plainly, a participant's totals and the leaderboard's will disagree, and that is worse than showing nothing.
- [ ] 5.5 EN and ES resources for every new string in this slice.
- [ ] 5.6 Run the slice verification.

## 6. Slice F — waiting

- [ ] 6.1 Write the acceptance feature for the added `see-the-results` requirement: how many votes are in out of how many expected, who has still to vote, that how far someone has got is **not** reported, that the read is refused to anyone who did not take part, and that waiting still works without it. Confirm it before implementing.
- [ ] 6.2 Add the read in the API: votes in, votes expected, and who is outstanding — sent or not sent, and nothing else. Partial progress must not be derivable from what it returns.
- [ ] 6.3 Gate it on the participant token that already gates the ballot, scoped to the one contest.
- [ ] 6.4 Check whether the MCP surface mirrors this read, and follow it if so.
- [ ] 6.5 Count this read when rate limits are reviewed: the waiting screen already polls every 2000ms and this rides that cadence.
- [ ] 6.6 Draw screen 11 (waiting for the reveal): the pulsing hourglass, the roster with those in marked and those still voting muted **and** labelled, the ways onward at the foot.
- [ ] 6.7 Keep the degraded answer working: where the standing cannot be read, the screen still says the results are being waited for rather than showing an error.
- [ ] 6.8 EN and ES resources for every new string in this slice.
- [ ] 6.9 Run the slice verification.

## 7. Slice G — reveal

Depends on `the-reveal-is-ready-to-be-restyled` having landed.

- [ ] 7.1 Write the acceptance feature for the modified `see-the-results`: the overall winner names the cook as well as the dish, and joint winners each name theirs. Confirm it before implementing.
- [ ] 7.2 Add the cook to the reveal payload beside the dish name, never in place of it. The field appears in the host's payload too because both routes share `toRevealDto`; the host simply does not draw it, and that is not a host redesign.
- [ ] 7.3 Draw screen 12 on the forked participant copy: the 112px rank numeral, the winning dish as the headline with the cook named beneath, the category panel, the leaderboard, no trophy.
- [ ] 7.4 Confirm the rendered-screen same-results test from the prior change still passes, and that it would still fail if this restyle changed the order, truncated the leaderboard, or renamed a dish. This slice is the first real exercise of that test.
- [ ] 7.5 Keep the entrance animation neutralised under reduced motion — the accessibility scans need a stable final frame, and it is one of the four properties the prior change recorded as not re-payable.
- [ ] 7.6 EN and ES resources for every new string in this slice.
- [ ] 7.7 Run the slice verification.

## 8. Closing out

- [ ] 8.1 Security review of the two disclosures together, now that both are built: the roster of taken places, and per-participant voting progress before the reveal.
- [ ] 8.2 Confirm the boundary held — no participant-shaped component ended up in `@tapas/ui`, and the host panel is drawn exactly as it was before this change began.
- [ ] 8.3 Check the built bundle against the baseline taken in 1.8.
- [ ] 8.4 Run the full accessibility pass across all fourteen screens: axe hard-gating, the 320px reflow test, and the manual keyboard and screen-reader checklist.
