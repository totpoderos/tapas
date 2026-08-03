# Design — A contest built by chat can be published

## Context

Publishing already knows what a draft is short of. `Contest.publish` refuses an
incomplete draft with a sentence built by a private `stillNeeded(content)` in
`packages/domain/src/contest/contest.ts`: "This contest cannot be published yet —
it does not say what kind of contest it is." That judgement exists in exactly one
place and is reachable only by trying to publish and being turned away.

Two paths lead a host to a draft, and they treat the contest format differently:

- The review form opens its "what kind of contest is this?" fieldset with a
  choice pre-selected (`useState(initial.format ?? 'solo')`), so pressing Save
  writes a format whether or not the host read the question. The host is shown
  the choice; the form answers it for them if they say nothing.
- The chat sets nothing, because nothing asks. `create_draft` takes an optional
  `format`, the system prompt tells the model not to guess, and the extraction
  path states the rule outright: "For format, scoring, and participants, NEVER
  guess a default". Format is one of the two high-stakes rules the participant
  text injection guard exists to protect.

Chat is right not to invent a format. What is missing is the question, and any
sign to the host that one is outstanding.

## Goals / Non-Goals

**Goals:**

- What a draft still needs is a thing the domain answers, in one place, shared by
  publishing and by reading a draft.
- A host who builds a contest by chat learns what is left while they are still in
  the chat, and can say it there.
- The assistant asks for the format rather than choosing one.

**Non-Goals:**

- Inventing a default format anywhere. The form's pre-selection is left as it is;
  changing it is a separate question about the form, not about this bug.
- Changing what publishing accepts. The same drafts publish before and after.
- Teaching the model what a specific draft is short of. Tool results are not fed
  back into the conversation, so the model asks from what the *host* left unsaid,
  not from what the draft turned out to lack. The panel is what reports the
  draft's own state.

## Decisions

### 1. `stillNeeded` becomes a list, in the draft, exported

Move it from a private sentence-builder in `contest.ts` to
`packages/domain/src/draft/` as:

```ts
export type DraftGap = 'format' | 'participants' | 'scoring';
export function stillNeeded(content: DraftContent): readonly DraftGap[];
```

Publishing keeps its sentence, now built from the list. It is a question about a
`DraftContent`, so it belongs beside `DraftContent`; that it was written inside
publishing is why nothing else could ask it.

*Alternative considered:* leave `stillNeeded` where it is and have the API
recompute the same three checks. Rejected — two copies of the publish rule is
precisely the shape of bug this repo keeps finding (a draft called ready and then
refused, or the reverse).

### 2. The gaps travel as keys, not as a sentence

The panel renders in English and Spanish. A server-composed sentence cannot be
translated, and the host app already owns every host-facing string. So the API
answers `['format']` and the panel says it — the same division as everywhere else
in these DTOs (`participants` and `categories` travel as names, the panel writes
the sentence around them).

### 3. Absent when there is nothing to say

`stillNeeded` is omitted, not `[]`, on a draft that needs nothing and on a live
contest — following `pairs`. A renderer that has to tell "nothing missing" from
"not computed" is a renderer that will eventually draw an empty warning on a
finished contest.

### 4. Two carriers, one producer, one reader

Draft answers come back in two shapes and both must carry this:

- the six by-name edit tools answer `{ details }`, built by `draftDetailsOf` —
  `stillNeeded` goes inside `ContestDetails`;
- `create_draft`, `rename_contest` and `get_draft` answer the stored draft, which
  has no details view — those routes add `stillNeeded` at the top level.

Applied to every route that answers with a stored draft, not only the three the
assistant uses: the review form reads the same drafts by id, and one of the two
staying quiet about the same draft is the asymmetry this repo keeps finding.

Both come from the one domain function, and the panel reads both through one
reader. Left alone, the create answer is the one a host meets first — "create a
contest called Tapas" is a single step, and its ticket is exactly where the
question should appear.

*Alternative considered:* make those three routes answer with details instead, so
there is one shape. Rejected — the review form reads the created draft's `id` and
`content` from that response, so this would churn the form's path to fix the
chat's.

### 4b. The live-contest details view is untouched

`stillNeeded` is only ever set by the draft builder. A live contest cannot be
short of anything, and a details view that carried the field for both would need
a rule about when to ignore it.

### 5. The panel asks; the prompt only forbids choosing

*Revised after measuring.* The plan was for the assistant to ask in its own
words, gated by an eval. It cannot: **this model returns no text at all alongside
tool calls** — eleven of eleven multi-tool cases came back with the calls and an
empty string. A question that appears only when the model happens to write one is
a question a host may never be asked, which is the defect this change exists to
close.

So the asking is deterministic. The panel says what the draft still needs and,
for the format, names the three kinds — the one gap a host cannot answer without
being told the choices. The system prompt keeps the half the model *is*
responsible for: never choose the format, the participants or the scoring, and
carry out everything that was asked rather than stopping. It also asks for the
format on the one path the panel cannot reach — a turn that replies in words and
calls no tool, where there is no draft to report on.

The first wording of that rule was rejected on measurement: "a contest cannot be
published until it says…" leaked into unrelated turns, and "Publish Winter Tapas"
became a `get_draft` check. See the trajectory doc.

### 5b. What the earlier plan said

The system prompt gains the rule as a rule: a contest cannot be published until
it says what kind it is, who is taking part and how it is scored; never choose
these for the host; when a message leaves one unsaid, carry out everything asked
and then ask for it, naming the choices. The model's asking is prompt-shaped and
so eval-gated, not test-gated.

Under it sits the deterministic half: the panel says what the draft still needs
on the ticket for the change, from the API's answer, whatever the model said.
This is the part that holds when the model's wording drifts, and it is the part
the acceptance tests pin.

### 6. Where it shows on the panel

On the ticket of a draft the assistant just changed, below what changed, as a
note in the host's terms — "Still needed before publishing: what kind of contest
it is." Shown as something left to say, not as a failure; a refusal already has
its own rendering and the two must not be confused.

In a multi-step run only the last result is drawn in full, so one run says this
once, on the step that leaves the draft in its final state.

## Risks / Trade-offs

- **The model ignores the prompt and never asks** → the panel still says what is
  missing, so the host is not stuck; an eval case covers the asking and gates it.
- **The model over-asks, interrupting runs to ask about scoring or people the
  host is plainly about to state** → the prompt puts the question *after* the
  work, never before it; the eval case asserts the tool calls still happen.
- **A host reads "still needed" as an error** → wording and rendering both say
  "left to say", and the refusal rendering is deliberately different.
- **The three gaps drift from what publishing actually checks** (a fourth rule is
  added to publish and not to the list) → they are the same function; publishing
  builds its own sentence from it, so a gap added in one is a gap in both.
- **`get_draft` and `rename_contest` grow a field their callers deep-equal in
  tests** → an added optional field, so runtime callers are unaffected; the tests
  that assert whole bodies are updated with the change.

## Open Questions

- The review form's pre-selected `solo` still answers the format question on the
  host's behalf when they never look at that fieldset. That is the form's own
  version of this bug and is left alone here; worth a look on its own terms.
