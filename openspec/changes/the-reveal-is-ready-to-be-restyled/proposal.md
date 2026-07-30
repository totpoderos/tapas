## Why

The reveal is one component, `@tapas/ui`'s `RevealView`, rendered by both apps. That is why `host-sees-the-results` can promise the host and a participant the same winners in the same order: today the promise is kept **by construction**, because there is only one thing to draw them.

A restyling of the participant app removes that construction. If the participant reveal is to look different from the host's, the shared component either grows a variant, splits, or is copied — and in every one of those cases the guarantee stops being free. The requirement stays true on paper while nothing checks it.

This change is groundwork, taken before the redesign rather than during it: decide how the reveal is shared, and put a test under the property that the sharing is currently standing in for.

The prompt for it was a scoping surprise worth recording. `RevealView` was expected to need restyling for the panel and does not — it already draws what the current design asks for, down to the leader's tinted plate and the winner's underline. So there is no visual work owed to the host panel here; the work that is owed is to the *next* design, and it is structural.

## What Changes

- **The same-results promise gains a test that does not depend on one component drawing both.** Today's coverage renders the host's screen and the participant's screen and reads each — but both resolve to the same component, so the assertion cannot fail for the reason it exists. It is pinned against the data instead, so it still holds when the two are drawn differently.
- **What a restyle may not undo is written down**, next to the component rather than in a commit message: saffron as an accent and never as text, the entrance animation neutralised under `prefers-reduced-motion`, rank carried by its number, and full i18n key paths because a missing key is read aloud as the key.
- **How the reveal is shared is decided**, with the decision recorded and its alternatives kept — a variant prop, a data/presentation split, or two copies — so the redesign starts from a choice rather than making one under time pressure.
- Not included, deliberately: **any new visual treatment**. The participant redesign does not exist yet, and inventing one here would be designing without a brief and would date the moment the real one arrives.

## Capabilities

### Modified Capabilities

- `host-sees-the-results`: the promise that both audiences are told the same outcome is stated to hold however each is drawn, not only while one component draws both.

## Impact

- `packages/ui` — `RevealView` gains the note about what must survive; no behaviour change.
- `packages/host-web`, `packages/participant-web` — no change until the redesign; this change exists so that one can begin safely.
- `tests` — a check that the two audiences are told the same thing, resting on the results themselves rather than on their sharing a renderer.
