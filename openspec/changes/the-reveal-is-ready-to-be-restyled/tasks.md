# Tasks

Groundwork, taken before the participant redesign rather than during it. No visual change: this exists so that one can begin without the same-results promise quietly going unheld.

## 1. Put a real test under the same-results promise

- [x] 1.1 Add the scenario "they still agree when they are drawn differently" to the acceptance feature for `host-sees-the-results`, comparing what the host's screen and the participant's screen *render* for the same revealed contest — winners, order, and the names dishes are given. Confirm it before implementing.
- [x] 1.2 Implement it across the two **rendered screens**, not the two API reads. The API-level check already exists (`a-host-sees-the-results.feature.spec.ts`, "The host and the participants see the same results") and it stays: it earns its keep by guarding that the two routes feed `toRevealDto` equivalent arguments. What it cannot see is the drawing — and once the reveal is two copies (task 3.1), the drawing is exactly where a divergence would live. A participant screen that sorted differently, truncated the leaderboard, or renamed a dish would pass every test in the suite today.
- [x] 1.3 Check the new test fails when the two renderings are made to disagree — a deliberate, reverted edit to one copy only — rather than trusting an assertion written after the fact.

## 2. Write down what a restyle may not undo

- [x] 2.1 Extend the note at the head of `reveal-view.module.css` from two properties to four: saffron as an accent and never as text (2.24:1 as text on the light ground), the entrance animation neutralised under `prefers-reduced-motion` so the accessibility scans have a stable frame, **rank carried by its number** rather than by weight or tint alone, and **full i18n key paths** because i18next reads a missing key aloud as the key.
- [x] 2.2 Point `RevealView`'s own header at that note, so somebody rewriting the markup meets it without reading the stylesheet.

## 3. Decide how the reveal is shared — when there is a design to decide against

- [x] 3.1 **Decided: C, two copies.** The participant design handoff ("Vermouth glass") arrived and diverges structurally, not decoratively — a 112px rank numeral, the winning dish as the headline with the cook named beneath it, glass panels, no trophy, and a palette the host panel does not share. The participant app is now its own visual language by decision, not by drift. Move the participant's reveal into `packages/participant-web`; `@tapas/ui`'s `RevealView` stays as the host's. `RevealData` stays shared — it is the shape both agree on.
- [x] 3.2 Whichever is taken, it must not be what holds the promise up. That is task 1's job, and it is why task 1 does not wait for this one. Under C this stops being a precaution: the shared renderer was the only thing checking the drawing, and it is going away.
