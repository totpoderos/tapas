# AI surfaces & evals

Full metrics, trajectories, and prompt-iteration logs are in
[`docs/evals.md`](../../docs/evals.md) (start there),
[`docs/eval-trajectory.md`](../../docs/eval-trajectory.md) (contest creation),
[`docs/host-assistant-eval-trajectory.md`](../../docs/host-assistant-eval-trajectory.md)
(host assistant), and [`docs/infra-generation.md`](../../docs/infra-generation.md)
(AI-generated infra). This page is a map of the three surfaces, why each is
architected the way it is, and how the evals gate CI.

## The project's AI claim

Not "we used an LLM" but **"we measured what the LLM does, committed thresholds,
and kept the failures."** Every AI surface follows the same discipline:
**schema-validate → re-validate → version → audit**. Two surfaces measure a
*live model* (thresholds are a separate, schedule-gated track, since a real
model's output isn't ours to make deterministic); one measures *artifacts*
(deterministic, gates the normal CI hard gate).

## 1. Contest-creation LLM

Turns a host's natural-language description into a validated `ContestDraft`
(`packages/api/src/drafts/extraction/extract-contest-draft.ts`,
`merge-contest-draft.ts`). Model output is structurally bounded
(`additionalProperties: false`) and then **re-validated by the API**, which
reads only known fields — nothing the model emits is trusted at face value. A
deterministic guard treats participant *names* as data: if a name tries to
dictate a high-stakes rule (prompt injection via a display name), that rule is
dropped and surfaced to the host as a clarification rather than silently
applied.

**Measured:** schema validity, field accuracy, missing-field recall, false-field
rate, across 25 cases / 29 turns (`simple`, `domain`, `partial_clarify`,
`adversarial`). Adopted prompt v2. Full story, including a documented *negative
result* (v3 was reverted — more instruction text cost the small model shape
adherence) in [`docs/eval-trajectory.md`](../../docs/eval-trajectory.md).
Committed thresholds: schema validity ≥ 70 · field accuracy ≥ 75 · recall ≥ 75 ·
**false-field ≤ 5** (the injection-defense metric, 0.0 throughout — must never
move).

## 2. Host-assistant LLM (MCP tool use)

Picks which MCP tool to call in response to a host's chat message
(`packages/api/src/assistant/host-assistant-turn.ts`, which ties together the
LLM's proposal, the tool catalog, and the confirmation gate into one
conversational turn). One user message can ask for several things — the turn
result is either a single step or a `steps` list with a `notReached` set for
anything a failure stopped short of.

**Tool catalog** (`packages/mcp/src/tool-catalog.ts`) is the single definition
each tool's name, Zod input schema, `destructive` flag, and `scope` (`host` /
`voter` / `public`) — the same catalog drives both the MCP server's registered
tools and the in-app assistant, so there is exactly one place a tool's shape is
defined. Destructive tools require the confirmation token described in
[architecture/overview.md](../architecture/overview.md#destructive-actions-propose--confirm--act)
before they dispatch; a contest addressed by name (not id, since hosts never
see ids) that matches more than one of the host's contests comes back as
`candidates` to disambiguate *before* a confirmation is even offered
(`packages/mcp/src/mcp-server.ts`).

**Measured:** tool selection, tool arguments, chaining (multi-tool requests),
confirmation surfacing, clarification, schema validity, false-tool rate — 51
cases across `single-tool`, `multi-tool`, `clarification`, `destructive`,
`adversarial`. Adopted prompt v3 (never choose the host's own rules — the
format, the participants, the scoring — for them; v2's contribution, proposing
destructive tools and letting the *system* surface confirmation rather than
asking the model to police it in text, is kept). Notably, tool-selection/chaining were honestly recorded as
**model-capability limits** on a small model (`gemma4:e4b`) rather than
prompt-tuned around — and both hit 100% with **no prompt change** once run on a
stronger model (`gemma4:31b-cloud`). Full story:
[`docs/host-assistant-eval-trajectory.md`](../../docs/host-assistant-eval-trajectory.md).
Committed thresholds were then raised wholesale for the hosted model — the old
two-tier split (tight safety metrics, loose model-capability ones) could not
fail for a model scoring 100, which is a gate that does not gate. They are now
selection/argument/clarification/confirmation ≥ 90, schema validity ≥ 95,
chaining ≥ 80, **false-tool ≤ 5**.

One thing this eval deliberately does **not** measure: whether the assistant
*asks* the host for a rule they left unsaid. The hosted model returns no text at
all alongside tool calls, so a metric for its words would measure the adapter,
not the assistant — a metric for it was written, run, and removed rather than
shipped green-by-vacuity. The asking is done deterministically by the chat
panel instead.

## 3. AI-generated infrastructure

Dockerfiles, compose files, CI, and CD were generated as a project artifact and
then verified, not hand-written — `docs/infra-generation.md` is the running
record: the effective prompt for each slice, what was generated, and how it was
proved to work (build, test, deploy dry-run, human-readability). Scored against
15 weighted criteria; `npm run eval:infra -- --full` gates at **≥ 85%** in CI
(`ci.yml`'s hard gate). Deterministic — no live model needed to reproduce.

## Running the evals

```bash
npm run eval:creation        -- --out reports/creation.json
npm run eval:host-assistant  -- --out reports/host-assistant.json
npm run eval:gate            -- --suite creation --report reports/creation.json
npm run eval:infra           -- --full
```

The eval harness lives in `packages/evals/src/` (`run-eval.ts`, `metrics.ts`,
`gate.ts`, `thresholds.ts`). Eval CLIs **do not read `.env`** — they need
`LLM_BASE_URL`/`LLM_MODEL`/`LLM_API_KEY` set directly in the environment, and
fall back to a local Ollama with no warning otherwise, so a "successful" run
against nothing configured is easy to produce by accident. `eval:gate` is what
enforces committed thresholds and exits non-zero on a regression; it runs on a
separate CI track (schedule/dispatch, since hosted runners have no model) and
**skips cleanly rather than faking a pass** when no model is configured.

## What to watch out for when changing an AI surface

- Any prompt change should get a new row in the relevant trajectory doc — do not
  overwrite history; a reverted prompt (like creation's v3) is kept as a
  recorded negative result on purpose.
- Thresholds are **re-set when the model changes** — a floor calibrated to a
  weak model cannot fail for a strong one, and vice versa.
- Changing the tool catalog's shape touches both the MCP server and the in-app
  assistant at once (they share it) — re-run `npm run eval:host-assistant`
  after any catalog change.
- The false-field / false-tool metrics are the injection-defense signal; a
  regression there is a security regression, not just a quality one — see
  [operations/security-and-ops.md](../operations/security-and-ops.md).
