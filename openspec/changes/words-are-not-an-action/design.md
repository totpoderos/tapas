## Context

`runAssistantMessage` answers with a top-level `reply` in exactly two cases: the model called no tool, and the model named a tool that could not be run (unknown, or arguments that failed the schema). Neither touches a contest. So `kind: 'reply'` means nothing happened — not usually, always.

The panel has that fact and does not use it. `chat.tsx` renders a reply as `{kind: 'assistant', text}`, the same bubble it uses for the model's words alongside a real result, so the model's account of events is the only account the host gets.

## Goals / Non-Goals

**Goals:**

- A host is never left with a model's claim as the only account of what happened.
- The statement is reliable enough to be read as absence-of-change, which means it appears every time.

**Non-Goals:**

- Judging whether the words claim completion. That is prose analysis, and it fails where it matters most.
- Changing what the model is allowed to say. The prompt is tightened, but a prompt is not a guarantee and is not what this rests on.
- Touching the `result`, `failed` or `steps` paths. They already report what happened; only the reply path is silent about what did not.

## Decisions

### The panel says it, in its own voice

Rendered as the existing `note` kind — already used for the panel speaking about the conversation rather than for the assistant speaking. It is styled apart from the bubble, so the app's account is not mistaken for more of the model's.

*Why not a new message kind:* nothing about this is a new category of thing. `note` is exactly "the panel telling the host something true about the exchange".

### Every reply, without exception

A marker that appears only where the words look like a claim would be absent after most clarifications, and a host who learns that would then read its absence as meaning something. The value of the statement comes from its being unconditional.

*The cost, accepted:* mild redundancy after an obvious question. Weighed against a host believing a contest exists, that is cheap.

### The prompt is tightened too, and is not the fix

The assistant is told not to report work it has not done. It costs one line and will help with a cooperative model. It binds nothing, which is why the panel does not depend on it.

## Risks / Trade-offs

- **Noise fatigue.** → A host who sees it after every question may stop reading it, which is the same failure as inconsistency by another route. Mitigated by keeping it short and quiet — one plain sentence in the panel's own style, not a warning banner. Worth revisiting if the panel ever grows a way to tell a question from an assertion honestly.

- **It says "nothing was changed" where the model asked a question.** → True and slightly odd to read. It is still the accurate statement, and the alternative is a rule with exceptions.

## Open Questions

- None. The wording is settled in EN and ES; the behaviour is one branch.
