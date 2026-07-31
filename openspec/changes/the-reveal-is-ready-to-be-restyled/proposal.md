## Why

The reveal is one component, `@tapas/ui`'s `RevealView`, rendered by both apps. That is why `host-sees-the-results` can promise the host and a participant the same winners in the same order: today the promise is kept **by construction**, because there is only one thing to draw them.

A restyling of the participant app removes that construction. If the participant reveal is to look different from the host's, the shared component either grows a variant, splits, or is copied — and in every one of those cases the guarantee stops being free. The requirement stays true on paper while nothing checks it.

This change is groundwork, taken before the redesign rather than during it: decide how the reveal is shared, and put a test under the property that the sharing is currently standing in for.

The prompt for it was a scoping surprise worth recording. `RevealView` was expected to need restyling for the panel and does not — it already draws what the current design asks for, down to the leader's tinted plate and the winner's underline. So there is no visual work owed to the host panel here; the work that is owed is to the *next* design, and it is structural.

## What Changes

- **The same-results promise gains a test that does not depend on one component drawing both.** Today's coverage renders the host's screen and the participant's screen and reads each — but both resolve to the same component, so the assertion cannot fail for the reason it exists. It is pinned against the data instead, so it still holds when the two are drawn differently.
- **What a restyle may not undo is written down**, next to the component rather than in a commit message: saffron as an accent and never as text, the entrance animation neutralised under `prefers-reduced-motion`, rank carried by its number, and full i18n key paths because a missing key is read aloud as the key.
- **How the reveal is shared is decided, and carried out**: two copies. The participant design handoff arrived while this change was open and diverges structurally, so the participant's reveal moves into `packages/participant-web` and `@tapas/ui`'s `RevealView` becomes the host's alone. `RevealData` stays shared — the shape is the thing that must agree.
- The move happens **here rather than in the redesign**, because the new test cannot be falsified while one component still draws both screens. Splitting them is what gives the assertion something to fail against; a test written before the split would pass by construction for the third time.
- Not included, deliberately: **any new visual treatment**. What lands here is a move — the participant copy renders exactly what it renders today. The vermouth restyle belongs to the redesign, which is where the brief for it is.

## Capabilities

### Modified Capabilities

- `host-sees-the-results`: the promise that both audiences are told the same outcome is stated to hold however each is drawn, not only while one component draws both.

## Impact

- `packages/ui` — `RevealView` gains the note about what must survive, and becomes the host's component; `RevealData` stays exported and shared.
- `packages/participant-web` — gains its own copy of the reveal, rendering what it renders today. No visual change lands here.
- `packages/host-web` — unchanged.
- `tests` — a check that the two audiences are told the same thing, across the two **rendered** screens. The existing API-level check stays: it guards that both routes feed `toRevealDto` equivalent arguments, which is a narrower property than it appears and is not the one at risk here.
