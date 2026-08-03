# Testing & spec-driven workflow

Tapas is built outside-in with **spec-driven design (OpenSpec) + double-loop
TDD/ATDD** — this isn't incidental process, it's a first-class part of the
project (README calls it out alongside security and accessibility as a
curriculum anchor). This page explains how the pieces fit together and where to
add tests when you change something.

## OpenSpec: the plan is the source of truth

[`openspec/`](../openspec) is spec-driven design tooling
([OpenSpec](https://github.com/Fission-AI/OpenSpec)):

- **`openspec/specs/`** — 27 capability specs (188 requirements), each a
  `Requirement`/`Scenario` document in plain domain language, describing
  **what the system currently does** (validated clean with
  `openspec validate --specs --strict`). This is the built-behavior record —
  more current than prose docs when the two disagree.
- **`openspec/changes/`** — proposals for *new* work. Each change is its own
  directory with a `proposal.md` (why + what), `design.md`, `tasks.md` (the
  phased build log), and `specs/<capability>/spec.md` deltas. Once merged, a
  change is synced into `openspec/specs/` and archived under
  `openspec/changes/archive/YYYY-MM-DD-<slug>/` — recent archives trace the
  project's most recent features (e.g.
  `archive/2026-08-02-scanning-the-code-opens-the-contest/` for the join-code
  QR feature).
- **`openspec/config.yaml`** — the project context handed to AI when
  authoring new changes: architecture, tech stack, and the testing/DDD/security
  discipline described below, in one place.
- **Picking up backlog work**: [`docs/backlog.md`](../docs/backlog.md) lists
  known-missing features and rough edges. The convention is
  `/opsx:propose <describe it>` then `/opsx:apply` to turn a backlog item into
  a new change. Run `openspec list` before starting: there is normally at most
  one change open at a time, and starting a second on the same capability is
  how two proposals end up disagreeing about the same spec.

## The double loop: ATDD outside, TDD inside

- **Outer loop (ATDD)** — one failing **Gherkin `.feature` acceptance spec**
  per user story, written in the glossary's domain language *only* — never
  class names, DB tables, endpoints, or file paths ("When the host publishes
  the contest", never "When a POST is sent to `/api/contests`"). This is the
  **spec-leakage rule**, and it's enforced by convention/review, not a linter —
  watch for it when writing new acceptance specs.
- **Inner loop (TDD)** — standard red/green/refactor unit tests for the
  internals that make the acceptance spec pass.
- Acceptance tests run via `vitest-cucumber` against **real repositories on
  in-memory SQLite** (migrations included) — persistence enforces vote
  invariants, so faking it would test the wrong thing. Only the **LLM, clock,
  and outbound notifications** are faked at this layer.
- Unit tests use application services with injected fakes (fakes preferred over
  verify-heavy mocks).
- `domain` gets pure unit tests with **no doubles at all** — including
  **property-based tests** (`fast-check`) for the compiler, which only pure,
  I/O-free code can support.

## Test layout — mirrors `src/`

Each workspace has source only in `src/` and a sibling `tests/` with `unit/`,
`integration/`, and `acceptance/` subfolders whose inner structure mirrors
`src/` — e.g. `src/foo/bar.ts` → `tests/unit/foo/bar.test.ts`. Whole-system E2E
(Playwright) lives at the **repo-root** `tests/e2e/`, not inside any one
workspace, because it spans host-web + participant-web + the API together —
see [`tests/e2e/README.md`](../tests/e2e/README.md) for why Docker (a mail
catcher) is a hard prerequisite for running it, and why invitation specs read
their link from the mail catcher's REST API rather than the database (which
only stores a token hash).

## Running everything

```bash
npm test          # unit + integration + acceptance across every workspace (Vitest, incl. Gherkin)
npm run test:e2e  # whole-system Playwright E2E — needs Docker running, boots Mailpit itself
npm run typecheck
npm run lint
npm run audit:ci  # supply-chain gate
```

Evals (`npm run eval:*`) are a **separate, non-TDD track** — threshold-gated
regression tests against a live model, with a documented trajectory rather than
a pass/fail unit test. See
[integrations/ai-surfaces.md](integrations/ai-surfaces.md).

## What to check when changing each major area

| Area | What to run/check |
|---|---|
| `domain` (rule space, compiler) | `packages/domain/tests/unit/**` — especially `compile.test.ts`'s property-based cases; add a Gherkin scenario if the change affects publish/reveal behavior visible to a host |
| `api` routes/use cases | the matching `tests/acceptance/*.feature(.spec.ts)` pair, plus `tests/unit/` for the use case; check ownership checks aren't weakened ([operations/security-and-ops.md](operations/security-and-ops.md)) |
| `mcp` tool catalog | `packages/mcp/tests/acceptance/*assistant*.feature` contract tests, and re-run `npm run eval:host-assistant` since the catalog drives both the MCP server and the in-app assistant |
| Either frontend | component tests under each package's `tests/unit/`, `jest-axe` accessibility assertions, and the relevant `tests/e2e/*.spec.ts` (axe-gated) |
| AI prompts | the eval CLI for that surface, then update the trajectory doc — see [integrations/ai-surfaces.md](integrations/ai-surfaces.md) |
| Anything touching auth/ownership | `docs/threat-model.md` §3.1 and the account-lockout/session tests in `packages/api/tests/unit/auth/` |

## Where to start when the codebase is unfamiliar

1. Read the relevant `openspec/specs/<capability>/spec.md` for the current
   contract of the behavior you're touching.
2. Find the matching `tests/acceptance/*.feature` — it's the executable,
   domain-language description of what should happen.
3. Trace from the acceptance spec into the use case, then the domain layer if
   the rule space is involved.
