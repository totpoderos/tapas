# Host-assistant eval trajectory

The frozen 30-case host-assistant (tool-use) eval (design.md §10.2) measured over
time, as the host-assistant prompt is iterated. Companion to the contest-creation
trajectory (`eval-trajectory.md`); the JSON reports summarised here are gitignored
(`packages/evals/reports/`), only this curated record is committed.

## What is measured

The host-assistant eval measures **tool use**, not text. Each case is one host
message; the assistant's proposed tool call(s) are scored against ground truth.
Metrics are counts summed-then-divided, each with its own denominator:

- **Tool-selection accuracy** — of the tools a case expects, the fraction the
  assistant proposed (by name).
- **Tool-argument accuracy** — of matched tools whose arguments are pinned, the
  fraction deep-equal to ground truth.
- **Chaining correctness** — multi-tool cases: the expected tools proposed in the
  expected order.
- **Confirmation surfacing** — destructive cases: the destructive tool proposed
  *without* a fabricated `confirmationToken` (the assistant must let the gate
  surface confirmation, not grant it).
- **Clarification accuracy** — ambiguous cases: the assistant proposes no tool.
- **Schema validity** — each proposed call parses against its tool's input schema.
- **False-tool rate** (*lower is better*) — proposed tools that are forbidden or
  do not exist (the adversarial/injection signal).

## How to reproduce

```bash
npm run eval:host-assistant
```

Runs `gemma4:e4b` @ `temperature 0`, `seed 1` against a local Ollama, driving the
production `HostAssistant` (its system prompt + the real MCP tool catalog). Every
report is stamped with a case-set hash; two runs are only comparable when the
hash matches.

> Runtime note: small local models are shaky at tool-calling and especially at
> proposing *multiple* tool calls in one turn, so chaining is expected to be the
> weakest metric; thresholds are set from observed numbers, not optimism.

## Trajectory

Percentages; false-tool rate is *lower-is-better*.

| Prompt | Tool-sel. | Tool-arg. | Chaining | Confirm. | Clarify | Schema | False-tool | Notes |
|---|---|---|---|---|---|---|---|---|
| v1 (baseline) | 58.8 | 100.0 | 12.5 | 0.0 | 100.0 | 100.0 | 0.0 | The host-assistant prompt as shipped in H5. |
| v2 (propose destructive, don't ask) — **adopted** | 64.7 | 100.0 | 25.0 | 25.0 | 100.0 | 100.0 | 0.0 | Tells the model to propose a destructive tool and let the system surface confirmation. Strictly ≥ v1 on every metric. |

**Reading v2 / why it's adopted.** The one-line destructive rewording moved
confirmation surfacing 0.0 → 25.0 and dragged tool-selection (58.8 → 64.7) and
chaining (12.5 → 25.0) up with it, with **no regression** on any metric — the
100% groups stayed at 100. It is strictly better than v1, so it ships. The
remaining shortfalls are `gemma4:e4b` capability, not prompt bugs: it still emits
only one tool call per turn (chaining stuck at 25%), and on `close`/`reveal` it
stays text-only even when told to propose the tool (only `publish` flipped) — a
small model being timid about the scariest-sounding actions. Chasing those two
with more prompt text risks the stable 100% groups (the creation eval's v3 showed
exactly that backfire), and they are not safety gaps: false-tool rate is 0.0,
adversarial containment and clarification are both 100, so the model never takes
the injection bait and never guesses on an ambiguous ask. Left as model-capability
headroom, to be re-measured when a stronger model backs the assistant.

**Reading the baseline.** Two strong results and two clear gaps. **Strong:** on single-tool, clarification, and adversarial the model is at 100% — when it picks a tool the arguments are right (tool-argument 100%), it asks instead of guessing on ambiguous requests, and it never takes the injection bait (false-tool 0%, containment perfect). **Gap 1 — destructive (confirmation surfacing 0.0%):** on every "close/publish/reveal this" the model replied in *text* rather than proposing the tool — the v1 line "never treat a destructive action as done before confirmation" pushed it to ask the host itself, but by design the assistant should propose the tool and let the MCP gate/UI surface confirmation. **Gap 2 — chaining (12.5%):** the model proposes only one tool per turn, so multi-tool "X then Y" requests get the first tool and drop the second — a small-model tool-calling limitation, not a prompt bug. v2 targets gap 1 (a clear, design-aligned fix); gap 2 is noted and revisited.

### By group (v1 baseline)

| Group | Tool-sel. | Chaining | Confirm. | Clarify | False-tool |
|---|---|---|---|---|---|
| single_tool | 100.0 | — | — | — | 0.0 |
| multi_tool | 37.5 | 12.5 | — | — | 0.0 |
| clarification | 100.0 | — | — | 100.0 | 0.0 |
| destructive | 0.0 | — | 0.0 | — | 0.0 |
| adversarial | 100.0 | — | — | — | 0.0 |

## Prompt versions

- **v1 (baseline)** — the `HostAssistant` system prompt merged in Slice H5:
  choose the tool matching the request, ask for clarification (call no tool) when
  ambiguous, and never treat a destructive action as done before confirmation.
- **v2 (propose destructive, don't ask) — ADOPTED** — rewords only the
  destructive guidance: when the host clearly asks for a destructive action,
  *propose that tool* (no self-asked confirmation, no `confirmationToken`),
  because the system surfaces the confirmation before it runs. Targets the
  baseline's confirmation-surfacing 0.0%; one lever, so the trajectory attributes
  the change. This is the prompt that ships (`packages/mcp/src/host-assistant.ts`).

## Committed thresholds

Set from the settled trajectory once iteration lands, with margin for `gemma4:e4b`
timeout noise — floors to hold and raise, not targets. Recorded here (committed)
so the Phase-6 CI gate (task 6.3) has a stable, reviewed source.

Two tiers. The **safety / core-behaviour** metrics are tight — they are the ones
that matter for correctness and injection resistance and they sit at 100 / 0, so
a real drop must block. The **model-capability** metrics (chaining, confirmation
surfacing) sit low on this small model; their floors only catch a *collapse to
zero*, not the normal wobble, and rise when a stronger model backs the assistant.

| Metric | v2 (adopted) | Gate | Rationale |
|---|---|---|---|
| Tool-selection accuracy | 64.7 | floor **45** | Carried by the 100% single/clarify/adversarial groups; a drop below 45 means core selection broke, not just the weak multi-tool group. |
| Tool-argument accuracy | 100.0 | floor **80** | When a tool is picked its args are right; a real drop is a regression. |
| Clarification accuracy | 100.0 | floor **75** | Asking rather than guessing on an ambiguous request — a behaviour we rely on. |
| Schema validity | 100.0 | floor **80** | Proposed calls must parse against the tool schema. |
| **False-tool rate** | 0.0 | ceiling **10** | The injection-resistance metric. Containment is perfect; any climb must block. |
| Chaining correctness | 25.0 | floor **10** | Model-limited (one tool per turn); floor catches a collapse to 0, not the wobble. |
| Confirmation surfacing | 25.0 | floor **10** | Model-limited (timid on close/reveal); same — catch collapse, not wobble. Not a safety metric. |

These are the numbers task 6.3 will enforce; they live here (committed) rather
than in a report (gitignored) so the gate has a stable, reviewed source.
