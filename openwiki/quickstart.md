# Tapas — OpenWiki Quickstart

Tapas is an AI-augmented app for running organized tapas (small-dish) contests:
a host opens a contest with a theme and rules, cooks submit a dish, judges taste
and score, and a winner is revealed at the end. It is built around a real
recurring event but generalized into a small, host-configurable **rule space**
that the system compiles and enforces.

It is also a master's thesis project. Alongside features, three things are
first-class deliverables with their own written evidence: **security** (OWASP-mapped
threat model), **evaluated AI** (three AI surfaces, each with a frozen eval set
and committed thresholds), and **accessibility** (WCAG 2.1 AA, gated in CI).

This wiki is a **navigation and synthesis layer** over the repository's own
excellent documentation — [`README.md`](../README.md), [`docs/`](../docs), and
the spec-driven design in [`openspec/`](../openspec). It links to those sources
rather than duplicating them; read this first to know *where* to look, then
follow the links for full detail.

## The idea, in one paragraph

A contest is a point in a five-dimensional rule space the host chooses: **format**
(solo / solo-with-partners / couples), **anti-bias** (who may not score whom),
**scoring range** (fixed `1..10` or an auto ranking `1..N`), **uniqueness** (strict
permutation vs. repeats allowed), and **categories** (e.g. Presentation,
Originality, Taste). On **publish**, that configuration is compiled — a pure
function, no I/O, no LLM — into a `MaterializedContest`: the constraint view the
runtime actually enforces. The rule language is never re-interpreted after that
point, which is why the score screen can adapt itself to the compiled rules and
an invalid score becomes impossible to enter. See
[domain-model.md](architecture/domain-model.md).

## System shape, in one paragraph

**One backend API** (Fastify + SQLite) is the single source of truth and the
*only* authority on authorization, with two auth scopes: host and voter. **Three
entry points** reach it — the two React SPAs (host app, participant app) over
session cookies, an external **MCP server** (a thin protocol adapter, no business
logic, host PAT over stdio), and an **in-app chat assistant** that dispatches
back through the very same API routes. Because every path converges on the same
routes, authentication, ownership checks, and audit logging happen **exactly
once**, in one place. Destructive actions (close, publish, reveal) are gated by
an action-bound HMAC confirmation enforced identically on every path. See
[architecture/overview.md](architecture/overview.md).

## Where to go next

| Section | What's there |
|---|---|
| [Architecture overview](architecture/overview.md) | The one-API/three-entry-point shape, ownership authorization, the confirm gate, the audit log as an event projection, the package graph, and the domain-purity boundary |
| [Domain model](architecture/domain-model.md) | The rule space, `Draft` → `Contest` lifecycle, the `compile()` function, scoring/vote invariants, and where the ubiquitous-language glossary lives |
| [Contest lifecycle workflow](workflows/contest-lifecycle.md) | The end-to-end journey — create (form or chat) → publish → join → submit dish → score → send → reveal — plus how a destructive action gets confirmed on every entry point |
| [AI surfaces & evals](integrations/ai-surfaces.md) | The three AI surfaces (contest-creation LLM, host-assistant/MCP tool use, AI-generated infra), how each is measured, and where the committed thresholds live |
| [Security & operations](operations/security-and-ops.md) | Authn/authz model, the threat-model summary, accessibility gating, environment configuration, and CI/CD/deployment |
| [Testing approach](testing.md) | The outside-in TDD/ATDD double loop, the `src/`/`tests/` layout convention, Gherkin acceptance specs, and how the hard gate vs. threshold gate distinction works |

## Repository layout at a glance

```
openspec/              # spec-driven design — the authoritative plan & specs
  specs/                 # 22 built capabilities, one folder per capability
  changes/                # active + archived change proposals (proposal/design/tasks/specs)
docs/                  # thesis artifacts: threat model, eval trajectories, infra-gen record, a11y pass
packages/
  domain/  shared/  ui/  evals/       # pure libraries + eval harness
  api/  mcp/  host-web/  participant-web/   # services + apps
deploy/                # production edge (Caddyfile)
tests/e2e/             # whole-system Playwright E2E (root-level, spans all packages)
```

Each workspace under `packages/` keeps `src/` for source only, with a sibling
`tests/{unit,integration,acceptance}/` tree that mirrors it — see
[testing.md](testing.md).

## How to run it (pointers, not a repeat)

- `npm install && cp .env.example .env && npm run dev` — API on `:3000`, host app
  on `:5173`, participant app on `:5174`. Full detail, including the Docker
  compose path, is in the root [`README.md`](../README.md#quick-start).
- `npm test` / `npm run test:e2e` / `npm run typecheck` / `npm run lint` /
  `npm run audit:ci` — see [testing.md](testing.md) and
  [operations/security-and-ops.md](operations/security-and-ops.md).
- `npm run eval:creation` / `npm run eval:host-assistant` / `npm run eval:gate` /
  `npm run eval:infra` — see [integrations/ai-surfaces.md](integrations/ai-surfaces.md).

## What to watch out for as a future agent

- **This repo is spec-driven.** `openspec/specs/` (22 capabilities, `openspec
  validate --specs --strict` clean) is the record of *built* behaviour; changes
  go through `openspec/changes/` proposals first. Prefer reading a capability's
  spec under `openspec/specs/<capability>/spec.md` over inferring behavior from
  routes alone.
- **Domain purity is lint-enforced.** `packages/domain` may not import I/O of any
  kind (no DB, no network, no LLM) — this is what lets the rule compiler be
  tested as a pure function, including property-based tests.
- **Acceptance specs use domain language only** — never class names, table
  names, endpoints, or file paths (the "spec-leakage rule"). See the glossary at
  `openspec/changes/archive/2026-07-28-tapas-contest-app/glossary.md`.
- **Existing docs are current, not stale.** `docs/*.md` and `README.md` were all
  touched in recent commits alongside the features they describe; when in doubt,
  trust them over guessing from code, and update them (not just this wiki) when
  behavior changes.
- **Known rough edges and deliberately-parked work** are tracked in
  [`docs/backlog.md`](../docs/backlog.md) (e.g. tie resolution is unbuilt, no
  reminder notifications, the `admin` role/`requireRole()` is deliberately
  parked). Check there before assuming something is a bug versus a known gap.

## Backlog

Areas intentionally not given their own page in this initial pass — still real,
just lower documentation value right now:

- **Per-component source maps for `host-web`/`participant-web`** (`packages/host-web/src/pages`,
  `packages/participant-web/src/pages`) — deferred; page/component names are
  self-describing and the workflow page already covers the user-facing journeys
  they implement.
- **OpenSpec change-proposal workflow mechanics** (the `/opsx:propose` /
  `/opsx:apply` CLI flow) — deferred; covered sufficiently by
  [`docs/backlog.md`](../docs/backlog.md) and `openspec/config.yaml`; not a
  system behavior future code-change agents need re-explained here.
- **Individual SQLite repository/migration internals** (`packages/api/src/db/*`) —
  deferred; each is a straightforward parameterized-SQL CRUD mapper per
  aggregate, not a distinct domain concept, and `docs/threat-model.md` §3.5
  already covers the injection-defense angle that matters.
