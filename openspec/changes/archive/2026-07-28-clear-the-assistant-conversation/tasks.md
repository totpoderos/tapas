## 1. Clearing the conversation

- [x] 1.1 Write the component test first, in domain language, and confirm it before implementing: clearing empties the panel, a cleared conversation does not come back after leaving and returning, the next question carries only the new exchange, clearing is announced, and there is nothing to clear on an untouched panel
- [x] 1.2 Add one `clearConversation()` that resets the visible feed, the message history sent to the model, and any action awaiting approval, and removes the stored copy — one function, so the three cannot drift apart
- [x] 1.3 Add the control to the assistant panel's top bar, disabled while there is no conversation to clear, keyboard-reachable and meeting the 44×44 target
- [x] 1.4 Announce the result through a `role="status"` line outside the feed — emptying a live region announces nothing, and a message inside the feed would contradict "nothing from the exchange remains"
- [x] 1.5 Give the control and the announcement their translations in English and Spanish
- [x] 1.6 Return focus to the message input after clearing, and check it does not talk over the announcement

## 2. The edges

- [x] 2.1 Make sure an answer already in flight when the host clears does not land in the cleared conversation
- [x] 2.2 Make sure the stored copy is not rewritten with the old conversation by a persist effect running after the reset — clear, remount, expect an empty panel
- [x] 2.3 Cover that clearing while the assistant waits for approval cancels the action and carries nothing out — **the real finding**: the confirmation card is `aria-modal` over a full-screen backdrop, so clearing is *unreachable* while an approval waits. jsdom does not simulate pointer interception, so the component test clicked straight through it; only the browser showed the truth. Spec and design amended; the E2E now asserts actionability (a trial click that must fail), the unit test asserts the reset's contract

## 3. Verifying

- [x] 3.1 Add an accessibility scan over the panel with a conversation and after clearing, at WCAG 2.1 AA
- [x] 3.2 Assert the model's view, not just the screen: after clearing, the next request carries only the new message — a clear that missed the history would look right and change every later answer
- [x] 3.3 Extend the assistant whole-system test: hold a conversation, clear it, reload, and confirm it is gone and a new one can be started
- [x] 3.4 Run the full verification: unit and acceptance tests, the whole-system tests, typecheck, lint, the supply-chain gate, and `openspec validate --strict`
- [x] 3.5 Smoke-test it live: confirmed against a running API that it holds no conversation between turns, so a clear is entirely the panel forgetting and there is no server state to leak. The stronger evidence is the whole-system test, which does the real journey in a real browser — clear, reload, start again
