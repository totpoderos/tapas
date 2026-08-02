## Context

`runAssistantMessage` reads `completion.toolCalls[0]` and returns one
`AssistantTurn`. Everything downstream — the route, the client, the panel —
assumes one message produces one outcome. The model has been proposing whole
chains all along; nothing has been reading past the first.

The confirmation gate is per-action: a token is an HMAC over one tool name and
its arguments, and `runConfirmedAction` carries out exactly that. That shape is
worth keeping, and it decides most of what follows.

## Goals / Non-Goals

**Goals:**

- Every call the model proposes is carried out, in order.
- A host reads back every step, including the ones that did not happen.
- A destructive action is approved on its own terms, never as a side effect of
  approving something else.
- The in-app path and an external MCP client agree about what one message does.

**Non-Goals:**

- Reordering, de-duplicating or parallelising the proposed calls. The order is
  the host's own, and later steps depend on earlier ones.
- Resuming a chain after a confirmation. What was not reached is named and the
  host asks again — see the decision below.
- Any change to how a single call is validated, dispatched or audited.

## Decisions

### The turn becomes a sequence of steps

`AssistantTurn` gains a `steps` form: an ordered list of what happened, each
entry the same `result` / `failed` shape a single turn already produces, ending
in an optional `confirm`. The single-outcome forms stay for a message that asks
for one thing, so nothing that reads one step has to learn a new shape.

*Alternative considered:* return the first outcome and a summary of the rest.
Rejected — the panel would still be reporting a fragment, which is the defect.

### A destructive action ends the chain, and is not resumed

Reversible steps before it run. The destructive one is put to the host as it is
today. Steps after it are **not** carried out and are named as not reached.

*Alternative considered:* carry the remaining calls through the confirmation and
continue on approval. Rejected on the security of it: a confirmation token would
then authorise a queue the host never saw named. The gate's whole value is that
it approves one action a host has read. Naming the unreached steps costs the host
one more message and keeps the approval honest.

### A failure ends the chain

The steps before it stand — they already happened — the failure is reported with
the API's own reason, and the rest are not attempted.

*Alternative considered:* attempt everything and report at the end. Rejected: a
failed `create_draft` would be followed by five failures against a contest that
does not exist, burying the one error that mattered.

### Each step is validated and dispatched exactly as a single call is

The per-call schema check, the destructive gate, the name settling and the audit
provenance all stay where they are. A chain is a loop around the existing
single-call path, not a second path through it — the alternative is two ways to
run a tool that agree until one of them is changed.

### The panel loops over steps

`chat.tsx` already renders a feed and reads each result by shape, so a chain is a
sequence of the renderings it already has. The new drawing is one line: what was
asked for and not reached.

## Risks / Trade-offs

- **A long chain is a long wait**, with nothing shown until it finishes. →
  Accepted for now: six calls against a local API is fast, and streaming the
  steps as they land is a bigger change to the route than this earns. Worth
  revisiting if chains get longer.

- **A partial chain leaves the contest half-configured.** → It always could —
  this is what the panel now reports honestly rather than hiding. There is no
  transaction across tool calls and inventing one would mean undo semantics for
  every operation.

- **The eval still measures proposal, not execution.** → This change is what
  makes the runtime match what the eval already scores. The trajectory gains a
  note saying which half the metric covers, so nobody reads 100% as proof the
  chain runs.

## Migration Plan

No data migration. The response shape changes, and the panel is the only client;
both ship together. Rollback is a revert.

## Open Questions

- Should a chain be capped? A model that proposes fifty calls would run fifty.
  Nothing observed has proposed more than a handful, and a cap that fires is
  worse than none until there is a number to justify.
