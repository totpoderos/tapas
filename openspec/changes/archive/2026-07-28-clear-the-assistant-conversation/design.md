## Context

The host's assistant panel (`packages/host-web/src/pages/chat.tsx`) holds a conversation in **three** places, and they are not the same thing:

```
   feed          what the host sees — user lines, assistant lines, action
                 tickets, refusals, contest lists, contest details
   history       the AssistantMessage[] sent to the model on EVERY turn
   sessionStorage  'tapas.chat.v1' — a copy of both, so the conversation
                 survives leaving the panel and coming back, and a reload
```

`feed` and `history` deliberately diverge: a contest list is rendered as a list in the feed but recorded in `history` as a one-line recap (`summariseRows`, `detailsSummary`), so the model keeps the context without the markup. Any clear has to reset all three, or the panel will look empty while the model still reads the old exchange.

Two further facts shape this:

- **The API is stateless between turns.** `POST /assistant/messages` takes `messages` in the request body (`assistant-routes.ts`) and holds nothing of its own. So clearing is entirely a client concern — no endpoint, no server state, no backend delta spec.
- **The feed is a live region.** It is rendered with `role="log"` and `aria-live="polite"`. Emptying a live region announces nothing, so a screen-reader user would get silence where a conversation used to be.

There is also a `pending` confirmation card: when the assistant proposes a destructive action, the panel holds a `PendingAction` (action, arguments, and the server-issued HMAC token) until the host accepts or cancels it.

## Goals / Non-Goals

**Goals:**

- A host can put the conversation down and start a clean one, in one action.
- The model's view of the conversation and the host's view of it are cleared together — they cannot fall out of step.
- The clear is perceivable without sight of the screen.
- Nothing is left half-approved behind an emptied panel.

**Non-Goals:**

- No history, undo, or "restore last conversation". Cleared is cleared.
- No multiple or named conversations, no conversation switcher. One panel, one conversation.
- No change to what the assistant can do, how destructive actions are confirmed, or what the audit log records.
- No server-side conversation store. The statelessness is a feature, not an omission to fix here.

## Decisions

### Clear all three, through one function

A single `clearConversation()` resets `feed`, `history`, `pending`, and removes the `sessionStorage` key. It is one function rather than three call sites so the set cannot drift — the failure this guards against is a future contributor clearing what is visible and forgetting what the model is told, which would look completely fine on screen.

The `sessionStorage` key is **removed**, not written with an empty conversation, so a cleared panel and a never-used panel are the same state. `loadChat()` already returns an empty conversation when the key is absent.

### No confirmation

Nothing the host authored is lost — the conversation is scrollback plus model context, and every action the assistant actually carried out is recorded in the audit log regardless. Set against how often a host will want a fresh start, a dialog on every clear costs more than it protects.

This is a deliberate departure from the pattern used for closing, revealing and deleting a contest, where `design.md` §7.1 makes "cannot be undone" the trigger for a confirmation. The distinction is what the action destroys: those destroy other people's work; this discards a conversation. The alternative — confirm only when a destructive action is pending — was considered and rejected as two behaviours behind one control, harder to explain to a host and harder to test than simply cancelling the pending action.

### Announce the clear, do not rely on the emptied feed

The result is announced through a `role="status"` line outside the feed, not by the feed's own live region. Emptying a live region does not reliably announce anything, and a message placed *inside* the feed would contradict the requirement that nothing from the exchange remains.

### The control is disabled, not hidden, when there is nothing to clear

A control that appears and disappears as the conversation starts is a moving target; a disabled one is a stable, discoverable affordance whose state explains itself. It follows the existing send button, which is disabled rather than hidden while the input is empty.

### Clearing cancels a pending confirmation — which the UI already prevents

`pending` holds a live, server-issued confirmation token. Clearing drops it: leaving it alive would let a host approve, from an empty screen, an action they can no longer see the reasoning for. Dropping it is a client-side cancel — the token was never spent, and the API never learns of it, exactly as when a host cancels a confirmation card.

**Found while implementing:** in practice this cannot happen. The confirmation card is `role="alertdialog" aria-modal="true"` over a full-screen backdrop, so while it is open the clear control is not reachable — the host settles the action first. The reset stays as the function's contract (defence in depth, and correct if the card ever stops being modal), but the guarantee worth testing at the whole-system level is the modality itself. The unit test asserts the contract; the end-to-end test asserts that clearing is out of reach.

This is also a reminder about test layers: jsdom does not simulate pointer-event interception, so the unit test clicking "clear" through a modal backdrop passed happily. Only the real browser showed the button was unclickable.

## Risks / Trade-offs

- **The three stores fall out of step.** → The whole point of one `clearConversation()`. The test that matters is not "the screen is empty" but "the next request carries only the new message" — assert on what is sent to the API, because a clear that misses `history` is invisible on screen and changes every later answer.

- **`sessionStorage` is written on a timer or effect after the clear.** → The panel persists on change; if the persist effect runs after the reset it must write the empty state or remove the key, never the stale one. Cover it with a test that clears, remounts, and expects an empty panel.

- **A clear mid-request.** → A turn already in flight resolves after the clear and would otherwise append its answer to the conversation the host just cleared. Ignore a response whose conversation has been cleared out from under it, the same way the participant screens ignore a resolved poll after unmount.

- **A shared component asking for translations an app has not got.** → Keys are added to the host app only, since the assistant panel exists only there; if any part of this lands in `@tapas/ui` later, use full key paths with English defaults and assert against the app's real resources (`LanguageSelect` announcing "language.label" is the precedent).

- **The announcement is missed or is too chatty.** → One `role="status"` line, polite, replaced rather than appended, so repeated clears do not stack announcements.

## Migration Plan

Purely additive and frontend-only. No schema change, no endpoint, no stored state beyond removing a `sessionStorage` key the app already owns. Rollback is removing the control and the reset function; a conversation cleared before a rollback stays cleared, which is indistinguishable from the host having closed the tab.

## Open Questions

- Where the control sits: the panel's top bar (beside the link back to contests) is the natural home, but whether it reads as a button labelled in words or as an icon button with an accessible name is a UI decision left to implementation. It must be reachable by keyboard and meet the 44×44 target either way.
- Whether clearing should return focus to the message input. Likely yes — the host clears in order to type something new — but it is worth checking it does not fight the status announcement.
