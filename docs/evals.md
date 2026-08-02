# The three AI surfaces, measured

*Task 6.9 — the consolidated eval record: all three eval sets, their metrics over
time, and the prompt-iteration log for each. This page is the overview; the
per-surface documents hold the full detail and are linked from each section.*

The claim this project makes is not "we used an LLM" — it is **"we measured what
the LLM does, committed thresholds, and kept the failures."** AI appears in three
distinct places here, and each one has a frozen eval set, tracked metrics, and a
gate.

---

## The three surfaces at a glance

| # | Surface | What is measured | Cases | Adopted prompt | Gate |
|---|---|---|---|---|---|
| 1 | **Contest creation** — natural language → validated draft | schema validity, field accuracy, missing-field recall, false-field rate | **25** (29 turns) | **v2** | 4 committed thresholds |
| 2 | **Host assistant** — request → MCP tool choice | tool selection, tool arguments, chaining, confirmation surfacing, clarification, schema validity, false-tool rate | **30** | **v2** | 7 committed thresholds |
| 3 | **Generated infrastructure** — Dockerfiles, compose, CI/CD | builds · tests pass · deploys (dry-run) · human-readable | **15 weighted criteria** | n/a (artifacts) | score ≥ 85% |

Surfaces 1 and 2 measure a **live model** and so are **threshold-gated on a
separate track** from the build — a real model's output is not ours to make
deterministic. Surface 3 measures **artifacts**, so it is deterministic and can be
run anywhere.

```bash
npm run eval:creation       -- --out reports/creation.json
npm run eval:host-assistant -- --out reports/host-assistant.json
npm run eval:gate           -- --suite creation --report reports/creation.json
npm run eval:infra          -- --full        # the infrastructure eval
```

Model for surfaces 1–2: **temperature 0, seed 1**, against whatever `LLM_BASE_URL`
/ `LLM_MODEL` / `LLM_API_KEY` point at. The trajectories were opened on
`gemma4:e4b` on a local Ollama; the host-assistant surface now runs
`gemma4:31b-cloud` on Ollama's hosted API. **Thresholds are set from observed
numbers, not optimism** — and re-set when the model changes, because a floor
calibrated to a weak model cannot fail for a strong one.

Note that the eval CLIs do **not** read `.env`; without the variables in the
environment they fall back to a local Ollama and silently measure nothing. See
the "How to reproduce" section of either trajectory.

---

## 1 · Contest creation

**Full detail: [`eval-trajectory.md`](eval-trajectory.md).** 25 cases / 29 turns,
across `simple`, `domain`, `partial_clarify`, and `adversarial`. Metrics are
**counts summed then divided**, never a mean of per-turn ratios, so a three-turn
case carries three turns of weight.

| Prompt | Schema validity | Field accuracy | Missing-field recall | False-field rate ↓ |
|---|---|---|---|---|
| v1 (baseline) | 34.5 | 84.3 | 90.9 | **0.0** |
| **v2 (nested-shape guidance) — ADOPTED** | **89.7** | **88.2** | 84.1 | **0.0** |
| v3 (restore high-stakes asking) — *reverted* | 58.6 | 83.9 | 88.6 | **0.0** |

**The iteration story.** The baseline's bottleneck was **shape, not answers**:
field accuracy was already 84.3%, but schema validity sat at 34.5% because the
model kept emitting malformed *nested* objects — 25 of 26 field rejections were
`scoring`, `closeRule`, and `revealStrategy`. v2 added those exact shapes to both
prompts and moved schema validity **34.5 → 89.7** (the `domain` category went
20 → 100).

**The negative result is the valuable one.** v2 cost some recall (90.9 → 84.1):
now that the model reliably *produced* well-shaped fields, it was less inclined to
*ask* about high-stakes ones it couldn't determine. v3 targeted that with an
imperative to always ask — and **schema validity collapsed 89.7 → 58.6** for
+4.5 points of recall. On a small model, more instruction text is not free: the
added emphasis crowded out the shape adherence v2 had won. **v3 was reverted and
kept in the trajectory as a recorded negative result**, not deleted.

**False-field rate is 0.0 throughout** — that is the injection-defense metric (see
below), and it is the one that must never move.

**Committed thresholds:** schema validity ≥ 70 · field accuracy ≥ 75 · recall ≥ 75
· false-field ≤ 5.

---

## 2 · Host assistant

**Full detail: [`host-assistant-eval-trajectory.md`](host-assistant-eval-trajectory.md).**
30 cases across `single-tool` (10), `multi-tool` (8), `clarification` (4),
`destructive` (4), `adversarial` (4).

| Prompt | Tool selection | Tool args | Chaining | Confirmation surfacing | Clarification | Schema validity | False-tool ↓ |
|---|---|---|---|---|---|---|---|
| v1 (baseline) | 58.8 | 100.0 | 12.5 | **0.0** | 100.0 | 100.0 | **0.0** |
| **v2 (propose destructive, don't ask) — ADOPTED** | **64.7** | 100.0 | **25.0** | **25.0** | 100.0 | 100.0 | **0.0** |

**The iteration story.** The baseline had two strong results and two clear gaps.
Strong: on single-tool, clarification, and adversarial cases the model was at
**100%** — when it picks a tool the arguments are right, it asks rather than
guesses on ambiguity, and **it never took the injection bait**. Gap 1:
confirmation surfacing was **0.0%** — on every "close/reveal this" the model
replied in *text* rather than proposing the tool, because v1's "never treat a
destructive action as done before confirmation" pushed it to ask the host itself.
By design the assistant should **propose the tool and let the system surface
confirmation**. v2 reworded exactly that, taking confirmation surfacing 0 → 25 and
pulling chaining 12.5 → 25 with it, **with no regression on any metric**.

**What was honestly still weak — and what became of it.** Tool selection at 64.7%
and chaining at 25% were **model-capability limits**, not prompt bugs:
`gemma4:e4b` proposes one tool per turn, so "X then Y" requests lose Y. Rather
than pile on prompt text — the creation eval's v3 showed what that costs — this
was recorded and left for a stronger model. That turned out to be the right call:
on `gemma4:31b-cloud` the same v2 prompt scores 100 on both, with no prompt
change at all. **It was never a safety gap either**: false-tool rate is 0.0 and
confirmation is enforced by the HMAC gate in code, not by the model's good
behaviour.

**Committed thresholds, two tiers.** Safety/core (tight): tool selection ≥ 45 ·
tool args ≥ 80 · clarification ≥ 75 · schema validity ≥ 80 · **false-tool ≤ 10**.
Model-capability (loose, catch a collapse not a wobble): chaining ≥ 10 ·
confirmation surfacing ≥ 10.

---

## 3 · Generated infrastructure

**Full detail: [`infra-generation.md`](infra-generation.md)** (prompt → output →
verification per slice). The eval itself is
[`scripts/infra-eval.mjs`](../scripts/infra-eval.mjs).

This surface produces *artifacts*, not runtime output, so the eval scores the four
dimensions the task names, as 15 weighted criteria that pass or fail:

| Dimension | Weighted | Score | What it checks |
|---|---|---|---|
| **Builds** | 6 | **100%** | a Dockerfile per deployable · trimmed build context · **every image actually builds** |
| **Tests pass** | 7 | **100%** | CI hard-gates typecheck/lint/tests · a11y gate · supply-chain gate · **the suite actually passes** |
| **Deploys (dry-run)** | 6 | **100%** | dev compose valid · **production manifest renders** · CD triggers on tag & pushes · TLS edge present |
| **Human-readable** | 6 | **100%** | ≥15% comment density on generated artifacts · generation documented · config documented · no baked secrets |
| **Overall** | **25** | **100%** | threshold **85%** |

*(Run 2026-07-25, `--full`: it really did build all four images, run the 935-test
suite, and render both compose manifests.)*

**The eval can fail** — verified, not assumed. Removing `.dockerignore` drops the
score to 93.3%; removing the CI workflow drops it to **60.0% and exits 1**. Its
job is regression detection: if someone deletes a gate, drops a Dockerfile, or
breaks a build, the number moves.

**Honest limit:** this scores *conformance and verifiability*, not elegance. It
cannot tell you the images are well-designed — only that they build, are
documented, keep secrets out, and deploy. Image size (~0.7–0.8 GB) is a known
tradeoff recorded in the generation doc, and it is deliberately **not** scored.

---

## What the three have in common

1. **Frozen case sets.** Each report is stamped with a **case-set hash**; two runs
   are comparable only when the hash matches, so adding cases can't silently
   flatter a trajectory.
2. **Thresholds committed in the repo, not in a report.** Floors live in
   [`thresholds.ts`](../packages/evals/src/thresholds.ts) and in these documents,
   reviewed like code. They are floors to **hold and raise**, not targets to
   celebrate.
3. **Gates fail closed.** A missing metric is treated as a breach, never a silent
   pass ([`gate.ts`](../packages/evals/src/gate.ts)).
4. **Negative results are kept.** v3 of the creation prompt is in the record
   precisely because it failed.
5. **Deterministic tests hard-gate; evals threshold-gate.** The build never depends
   on a model being available or being in a good mood — and a model-less CI run
   **skips the eval job rather than faking a pass**.

## The lesson worth defending

Across both model surfaces the same finding recurs: **on a small model, prompt
text is a scarce resource.** Every instruction competes with every other. v2 of
the creation prompt won 55 points of schema validity by describing *shapes*; v3
lost 31 of them by adding one more *imperative*. The productive move was to make
the system deterministic where correctness matters — schema re-validation, the
participant-name guard, the HMAC confirmation gate — and let the model do only the
part that genuinely needs judgement.

Related: [`threat-model.md`](threat-model.md) · [`architecture.md`](architecture.md) · [`demo-script.md`](demo-script.md)
