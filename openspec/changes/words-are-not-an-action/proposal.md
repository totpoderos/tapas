## Why

The chat panel renders a model's reply and a carried-out action in the same voice. A model that answers *"I've created the contest 'testing'"* without calling a tool has changed nothing, and the host is told it worked — by their own app, in the app's own window.

This is not hypothetical. It is exactly what a production defect looked like from the host's side for as long as that deployment existed: the assistant reported success for every action and wrote nothing. That cause is fixed (the dispatch was being redirected), but the panel's inability to tell "the assistant did it" from "the assistant said it" is what made it invisible, and it outlives the bug that exposed it.

The panel is the only party in the conversation that knows the difference for certain. `runAssistantMessage` returns a top-level `reply` **only** when no tool was called — the model called none, or the call was unknown or unparseable. So a reply means nothing happened, always, and the panel has that fact in hand while the host does not.

## What Changes

- **When the assistant answers in words, the panel says that nothing was changed** — in its own voice, as a note, visually distinct from the assistant's bubble rather than as more prose from the same speaker.
- **Every time, including ordinary clarifications.** A marker shown only sometimes teaches a host to read nothing into its absence; consistency is the whole of what makes it worth trusting. The cost is mild redundancy after *"Which contest do you mean?"*, which is a price worth paying for a statement that can be relied on.
- **The assistant is told not to narrate work it has not done.** Defence in depth only: a prompt does not bind a model, and the panel's note is the guarantee.

Not included, deliberately: detecting whether the model's words *claim* completion. That means keyword-matching prose, and it would fail exactly where the phrasing is unusual — a guarantee resting on a heuristic is not one.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `converse-with-the-host-assistant`: the capability has requirements for saying what the assistant *did* — what it changed about a draft, which step failed, what a name matched — and none for saying when it did nothing at all. It gains that.

## Impact

- `packages/host-web` — one note added on the reply path in `chat.tsx`; EN and ES wording. No new message kind: `note` already exists for the panel speaking in its own voice.
- `packages/api` — a line in the host-assistant system prompt.
- Tests — component tests for both the clarification and the claims-completion case; the existing e2e scenario for clarifying gains the assertion, and a new scenario covers the claim.
