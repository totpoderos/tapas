# Tasks — A contest built by chat can be published

Two slices, each its own ATDD loop and its own PR. Slice A is the whole
deterministic half — the domain, the API and the panel. Slice B is the model's
asking, which only evals can gate.

## 1. Slice A — a draft says what it still needs

- [x] 1.1 Write the acceptance scenarios first: the API feature for a draft's
      details carrying what it still needs, and the E2E scenario for the panel
      saying it after a chat-built contest. Red before anything else.
- [x] 1.2 Move `stillNeeded` out of `contest.ts` into the draft, exported, as a
      list of `DraftGap`; publishing builds its refusal sentence from the list.
      Domain unit tests for each gap, all three at once, and none.
- [x] 1.3 Carry it in `ContestDetails` via `draftDetailsOf` — absent when the
      draft needs nothing, never set for a live contest.
- [x] 1.4 Add it at the top level of the three stored-draft answers (`POST
      /drafts`, `PATCH /drafts/by-name`, `GET /drafts/by-name`) from the same
      function.
- [x] 1.5 Read it in the chat panel through one reader that takes it from either
      carrier, and render it on the ticket as something left to say — with EN and
      ES strings, keeping the translation-parity guard green.
- [x] 1.6 Component tests for the three panel cases: a gap named, several gaps
      named, and a ready draft carrying nothing.
- [ ] 1.7 Green the E2E scenario and the full local gate.

## 2. Slice B — the assistant asks for what is missing

- [ ] 2.1 Add the rule to the host-assistant system prompt: a contest needs to
      say what kind it is, who is taking part and how it is scored; never choose
      those for the host; carry out everything asked, then ask for what was left
      unsaid, naming the choices.
- [ ] 2.2 Add the eval case: the reported prompt, with no format stated —
      asserting every asked-for tool call still happens, that `set_format` is
      *not* among them, and that the reply asks what kind of contest it is.
- [ ] 2.3 Run the eval, record the numbers in the trajectory, and move the
      threshold only if the run supports it.

## 3. Close out

- [ ] 3.1 Look at it by hand: the reported prompt, in a browser, from empty to
      published without leaving the chat.
- [ ] 3.2 `openspec validate --strict`, then archive the change.
