# Tasks

Groundwork, taken before the participant redesign rather than during it. No visual change: this exists so that one can begin without the same-results promise quietly going unheld.

## 1. Put a real test under the same-results promise

- [ ] 1.1 Add the scenario "they still agree when they are drawn differently" to the acceptance feature for `host-sees-the-results`, comparing what the host's read and the participant's read answer for the same revealed contest — winners, order, and the names dishes are given. Confirm it before implementing.
- [ ] 1.2 Implement it against the two API reads rather than the two screens. The screens resolve to one component today, so an assertion through them cannot fail for the reason it exists; it would go on passing through a divergence that had already happened.
- [ ] 1.3 Check the new test fails when the two are made to disagree — a deliberate, reverted edit — rather than trusting an assertion written after the fact.

## 2. Write down what a restyle may not undo

- [ ] 2.1 Extend the note at the head of `reveal-view.module.css` from two properties to four: saffron as an accent and never as text (2.24:1 as text on the light ground), the entrance animation neutralised under `prefers-reduced-motion` so the accessibility scans have a stable frame, **rank carried by its number** rather than by weight or tint alone, and **full i18n key paths** because i18next reads a missing key aloud as the key.
- [ ] 2.2 Point `RevealView`'s own header at that note, so somebody rewriting the markup meets it without reading the stylesheet.

## 3. Decide how the reveal is shared — when there is a design to decide against

- [ ] 3.1 **Blocked on the participant redesign, deliberately.** The choice between one component with a variant prop, a shape/drawing split, and two copies depends on how far the two layouts diverge, and cannot be made well without seeing one of them. design.md records the three and what each costs.
- [ ] 3.2 Whichever is taken, it must not be what holds the promise up. That is task 1's job, and it is why task 1 does not wait for this one.
