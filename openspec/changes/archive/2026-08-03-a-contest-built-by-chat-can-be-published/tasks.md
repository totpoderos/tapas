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
- [x] 1.4 Add it at the top level of the stored-draft answers from the same
      function. Widened from the three assistant-facing routes to all six: a
      draft read by its name and the same draft read by its id staying quiet is
      the asymmetry this repo keeps finding, and one helper covers both.
- [x] 1.5 Read it in the chat panel through one reader that takes it from either
      carrier, and render it on the ticket as something left to say — with EN and
      ES strings, keeping the translation-parity guard green.
- [x] 1.6 Component tests for the three panel cases: a gap named, several gaps
      named, and a ready draft carrying nothing.
- [x] 1.7 Green the E2E scenario and the full local gate.

## 2. Slice B — the assistant asks for what is missing

- [x] 2.1 Add the rule to the host-assistant system prompt: never choose the
      format, the participants or the scoring for the host; carry out everything
      asked. **Rescoped mid-slice**: the first wording ("a contest cannot be
      published until it says…") leaked into unrelated turns — "Publish Winter
      Tapas" became a `get_draft` check, dropping confirmation surfacing below
      its floor — so the publishing framing came out and was measured again.
- [x] 2.2 Add the eval case: the reported prompt, with no format stated —
      every asked-for tool call happens, in order, and `set_format` is forbidden.
      **The reply cannot be measured**: this model returns no text at all
      alongside tool calls (eleven of eleven multi-tool cases), so a metric for
      the asking was written, run, and removed rather than shipped vacuously
      green.
- [x] 2.3 Ask the host deterministically instead, from the panel: name the three
      kinds beside what the draft still needs, so the question is put whether or
      not the model says anything.
- [x] 2.4 Run the eval, record all three runs in the trajectory — including the
      rejected prompt and the rule-deleted control — and leave the thresholds
      where they are.

## 3. Close out

- [ ] 3.1 Look at it by hand: the reported prompt, in a browser, from empty to
      published without leaving the chat. **NOT DONE, and left open on purpose.**
      Signing into the host app needs the host's own credentials, so this is the
      host's to do. Both halves were verified separately against the real things
      — the reported prompt against the live model in the eval (all eight calls,
      in order, no invented format), and the panel in a real browser end to end
      (the note appears; saying the format clears it) — but nobody has yet sat
      down and gone from an empty chat to a published contest in one sitting.
      That is the check that has found something no test could in four
      consecutive slices, and it has not been made here.
- [x] 3.2 `openspec validate --strict`, then archive the change.
