# The assistant carries out everything that was asked

## Why

A host writes one message that asks for several things — *"Create a new contest
called Tapas. Add two categories: Taste and Originality. Add three participants:
Carlos, Alba and Juan"* — and gets a contest called Tapas and nothing else. No
categories, no people, and nothing said about the five things that did not
happen.

The model is not the problem. Asked exactly that, it proposes all six calls, in
the right order, with the right arguments. The in-app assistant then takes
`toolCalls[0]` and discards the rest. A host has no way to know: the panel
reports the one action that ran as though it were the whole answer.

This is in-app only. An external MCP client drives each call itself, so the same
six run for anyone connecting that way — the two paths disagree about what one
message can do.

It is also a gap our own measurement could not see. The host-assistant eval
scores *chaining correctness* — whether the model proposes the right tools in the
right order — and it scores 100. It measures what is proposed, never what is
carried out, so the metric was green for a feature that has never worked.

## What Changes

- **A message may ask for several things, and all of them happen.** The
  assistant carries out every tool call the model proposes, in the order it
  proposed them, rather than the first alone.
- **The panel reports every step**, in order, so a host reads back the whole of
  what happened rather than a fragment of it.
- **A destructive action stops the chain.** Everything reversible before it is
  carried out, then the host is asked to confirm that one action, and the chain
  ends there. What was not reached is named, so a host knows what is left to ask
  for. A confirmation approves the one action it names and never a queue of
  others behind it.
- **A step that fails stops the chain**, with what succeeded, what failed and why
  all reported. Later steps commonly depend on earlier ones, so carrying on past
  a failure turns one honest error into a cascade of confusing ones.
- The assistant's answer becomes a **sequence of steps** rather than a single
  outcome. This is a change to what `/assistant/messages` returns and to what the
  panel renders.

Not in scope: reordering or de-duplicating what the model proposes, and running
steps concurrently. The order the model gives is the order the host said, and
later steps depend on earlier ones.

## Capabilities

### New Capabilities

None. This is the same conversation doing what it always claimed to.

### Modified Capabilities

- `converse-with-the-host-assistant`: one message may ask for several things, and
  the panel reports each of them; the destructive and failure rules gain their
  chain-level behaviour.
- `assistant-tool-surface`: the requirement that the assistant proposes an action
  and the tools carry it out now covers a proposal of *several* actions.

## Impact

- `packages/api/src/assistant/host-assistant-turn.ts` — the turn becomes a
  sequence. This is the file with the defect and the only place the chain is
  decided.
- `packages/api/src/http/assistant-routes.ts` — the response shape.
- `packages/host-web` — the panel already renders a feed, so it gains a loop over
  steps rather than a new way of drawing; the confirmation card and the
  what-was-not-reached line are new.
- Both assistant paths' tests, the deterministic E2E stub (which today answers
  with one call per message), and the chat E2E.
- `packages/evals` — worth recording that chaining measures proposal, not
  execution, so the next person reading 100% knows what it does and does not say.
