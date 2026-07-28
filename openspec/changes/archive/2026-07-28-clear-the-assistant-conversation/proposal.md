## Why

The assistant panel only ever grows. Everything a host has said to it, every action ticket, every refusal and every list of contests stays on screen from the moment they first open it until they close the browser tab — there is no way to put it down and start again.

That matters more than tidiness, because the conversation is not just scrollback: it is the `history` sent to the model on every turn. A long, wandering conversation is context the model keeps reading, so an early misunderstanding, an abandoned line of questioning or a stale list of contests keeps influencing answers. Today the only way to get a clean start is to close the tab.

## What Changes

- **A way to clear the conversation from the assistant panel.** It empties what is on screen, forgets the history the model is given, and forgets the copy kept for coming back to the screen — all three, because a clear that left any of them would be a lie.
- **It takes effect at once, and says so.** No confirmation step: nothing the host created is lost, and it is an action they will reach for often. What happened is announced, so it is not a silent screen wipe.
- **There is nothing to clear when the conversation is empty**, and the control says so rather than doing nothing when pressed.
- **A confirmation the host was midway through approving is cancelled with it.** Clearing must not leave an approved-but-unrun destructive action alive behind an empty screen.
- No change to what the assistant can do, to how any action is confirmed, or to anything stored on the server — the assistant holds no conversation of its own between turns.

## Capabilities

### New Capabilities

- `clear-the-assistant-conversation`: a host puts the assistant conversation down and starts a fresh one — on screen, in what the model is told, and in what survives leaving the screen — with nothing left pending behind it.

### Modified Capabilities

None. `converse-with-the-host-assistant` keeps every requirement it has: this adds a way to end a conversation rather than changing how one is held, and the confirmation flow for destructive actions is untouched.

## Impact

- **Host app** — a control in the assistant panel, and the reset of the three places a conversation lives: the visible feed, the message history sent to the model, and the `sessionStorage` copy that survives navigating away.
- **Accessibility** — the panel's feed is a live region, so emptying it needs to be announced rather than leaving a screen-reader user with silence where a conversation was.
- **Not the API** — the assistant is stateless between turns; the history arrives in each request. Clearing is entirely a client concern, which is why this change adds no endpoint and no delta spec for the backend.
- **Not the audit log** — actions the assistant already carried out stay recorded. Clearing forgets the conversation, not the history of what was done.
