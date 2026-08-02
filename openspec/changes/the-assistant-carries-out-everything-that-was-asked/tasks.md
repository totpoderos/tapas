Planned as two sub-slices; shipped as one, for the reason below. The acceptance
`.feature` is written and confirmed before implementation starts, and the work
ends on the full local gate — unit, whole vitest run, typecheck, lint,
`openspec validate --strict`, and the E2E suite — since CI is off.

## 1. One slice, not two — a message that asks for several things gets all of them

**The split did not survive.** Slice A was to change the API and Slice B the
panel, but the panel's last branch assumes a confirmation: a run of steps would
have fallen into it and opened a confirmation card for an action with no name.
Shipping the API change alone would have broken the panel for exactly the prompt
that was reported — worse than the bug. The panel is not polish here, it is what
makes the change shippable, so both went in together.

- [x] 1.1 Write the acceptance feature: several actions in one message all carried out, in order; a destructive one ends the run after the reversible steps before it; a failing step ends the run with what happened and what did not — confirm it before implementing
- [x] 1.2 Turn the single-outcome turn into an ordered sequence of steps in `host-assistant-turn.ts`, looping the existing single-call path rather than adding a second way to run a tool
- [x] 1.3 Stop at the first destructive call: run what precedes it, put that one to the host, and carry the names of what was not reached
- [x] 1.4 Stop at the first failure, keeping what already happened and reporting the reason
- [x] 1.5 Unit tests over the run: order, the destructive stop, the failure stop, a call that cannot be understood, and that a one-action message is unchanged
- [x] 1.6 ~~Widen the response shape in `assistant-routes.ts`~~ — nothing to do: the route declares no response schema and returns the turn verbatim, which the acceptance spec proves by reading a `steps` body back through it
- [x] 1.7 Loop `chat.tsx` over the steps and name what was not reached, EN and ES
- [x] 1.8 Component tests: a run of results, a run ending in a confirmation, a run ending in a refusal
- [x] 1.9 Teach the deterministic E2E stub to answer one message with several calls, and drive the reported prompt end to end in the browser
- [x] 1.10 Look at it by hand
- [x] 1.11 Full local gate, then PR

**What the hand-look found, twice.** The tests were green and the screen was
not:

- **Six near-identical cards.** Every step answers with the whole draft as it
  then stood, so a six-step run drew six cards differing by a line each, with the
  state the host actually wants buried at the bottom looking like the five above
  it. Only the last result is drawn in full now; the ones before it say what they
  did in a line.
- **The sidebar then lied.** Drawing a step as a ticket skipped the branch that
  re-reads the contest list, so the panel said "no contests" straight after
  making the host one. The list is re-read once per run.

Neither was visible to any test. This is the fourth slice running where looking
at the screen found something the suite could not.

**Left as it is, and worth knowing:** an intermediate ticket says "add category —
done" without naming *which* category, because a step carries its action and its
result but not the arguments it was called with. The final card carries the
truth, so nothing is lost — naming them would mean widening the step shape.

## 2. Close out

- [x] 2.1 Note in `docs/host-assistant-eval-trajectory.md` that chaining correctness measures what the model PROPOSES, not what is carried out — it read 100% throughout the whole time the runtime ran only the first call
- [ ] 2.2 Sync the delta specs and archive the change
