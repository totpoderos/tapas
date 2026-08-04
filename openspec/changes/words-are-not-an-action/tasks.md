One slice, one ATDD loop, one PR.

## 1. The panel says when nothing was carried out

- [x] 1.1 Acceptance scenarios in `tests/e2e/host-chat-panel.feature`: the clarification gains the assertion, and a new scenario covers words that claim a contest was created. **Confirm with the user before implementing.**
- [x] 1.2 Component test: a reply renders the model's words AND the panel's note. Red first.
- [x] 1.3 Component test, the dangerous one: a reply claiming "I've created the contest" still gets the note, and the claim does not stand alone.
- [x] 1.4 Component test: a carried-out action does NOT get the note — the statement has to mean something by its absence on the other paths. — passed from the start, which is the point: it pins the absence rather than driving the change.
- [x] 1.5 Implement on the reply path in `chat.tsx`, as a `note`. Nothing else changes.
- [x] 1.6 EN and ES wording.
- [x] 1.7 One line in the host-assistant system prompt telling it not to narrate work it has not done. Defence in depth; the note is the guarantee.
- [x] 1.8 Verify: full vitest + typecheck + lint + `openspec validate --all --strict`. PR. — **not** verified by eye in a running browser: seeing it needs the API, a signed-in host and a model that answers in words, and the claim at stake is that the note reads apart from the assistant's bubble. That is settled by the stylesheet — `.note` is centred, muted, 14px and italic, against a padded, rounded, left-aligned bubble — and by the component tests for the text. Said plainly rather than implying a look that did not happen.

## 2. Close out

- [ ] 2.1 `openspec archive`, folding the delta into `converse-with-the-host-assistant`.
