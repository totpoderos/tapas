# Tapas

Create and run tapas contests — one backend API, two frontends, and an MCP-mediated AI host assistant.

Tapas is an AI-augmented app for organized tapas competitions: a host opens a contest with a theme and rules, cooks submit their dish, judges taste and score, and a winner is revealed at the end. It is built around a real recurring event but generalized into a small **rule space** the host configures and the system enforces.

It is also a master's thesis project, so three things are first-class deliverables alongside the features: **security** (OWASP-mapped, with a written [threat model](docs/threat-model.md)), **evaluated AI** (three AI surfaces, each with its own eval set and committed thresholds), and **accessibility** (WCAG 2.1 AA, gated in CI).

> **Status:** feature-complete and playable end to end — create (by form *or* chat) → publish → join → submit a dish → score → send → reveal, with a host control room and a unified audit log. **935 unit/acceptance tests + 58 Playwright E2E**, all axe-clean. Design is spec-driven with [OpenSpec](https://github.com/Fission-AI/OpenSpec) in [`openspec/`](openspec/) — see the [proposal](openspec/changes/tapas-contest-app/proposal.md), [design](openspec/changes/tapas-contest-app/design.md), [tasks](openspec/changes/tapas-contest-app/tasks.md) (the authoritative build log), and [glossary](openspec/changes/tapas-contest-app/glossary.md).

## The idea

A tapas contest is not one product but a point in a five-dimensional rule space:

- **Attribution** — per person or per couple
- **Anti-bias** — none, couples, or arbitrary no-score pairs
- **Scoring range** — fixed `1..10` or `1..N`
- **Uniqueness** — strict permutation (ranking) or allow repeats (rating)
- **Categories** — configurable (e.g. Presentation, Originality, Taste)

The host expresses these choices; on **publish** they are *compiled* (a pure function — no I/O, no LLM) into a materialized constraint view the runtime enforces. The rule language is never re-interpreted at runtime, and the score screen adapts itself to the compiled rules so an invalid score is impossible to enter.

## Quick start

Requires **Node ≥ 24** (uses the built-in `node:sqlite`).

```bash
npm install
cp .env.example .env       # dev defaults work as-is; set real secrets for anything deployed
npm run dev                # api :3000 · host app :5173 · participant app :5174
```

`npm run dev` reads the root `.env` automatically (via Node's `--env-file`), so no
manual exporting is needed. The MCP server speaks stdio and is launched by an MCP
client, not a web service — run it on its own with a real host PAT when needed:
`MCP_HOST_TOKEN=<pat> npm run dev:mcp`.

Or run the whole stack in containers:

```bash
docker compose up --build  # host app :4173 · participant app :4174 · api :3000
```

Open the **host app**, sign up, create a contest (form or chat), publish it, and share the join code with the **participant app**.

## How to test

```bash
npm test          # 935 unit + integration + acceptance (Vitest, incl. Gherkin .feature specs)
npm run test:e2e  # 58 whole-system E2E (Playwright: real API + both apps + SQLite), axe-gated
npm run typecheck
npm run lint
npm run audit:ci  # supply-chain gate: blocks on high/critical advisories
```

The E2E boots a real API (in-memory SQLite) and both frontends and drives Chromium — including the cross-app payoff: a host reveals results and a waiting participant sees them without reloading. **Accessibility is a hard gate** — axe-core runs inside the E2E, so a violation fails the build.

## How to evaluate

The AI surfaces are measured, not assumed. Evals need a local [Ollama](https://ollama.com) (or any OpenAI-compatible endpoint via `LLM_BASE_URL`).

```bash
npm run eval:creation        -- --out reports/creation.json         # contest-creation extraction
npm run eval:host-assistant  -- --out reports/host-assistant.json   # host-assistant tool use
npm run eval:gate            -- --suite creation --report reports/creation.json
npm run eval:infra           -- --full                              # generated infrastructure
```

`eval:gate` enforces the **committed thresholds** (floors/ceilings recorded in the trajectory docs) and exits non-zero on a regression. Deterministic tests hard-gate the build; evals are threshold-gated on a separate track, because a real model's output is not ours to make deterministic.

- **[`docs/evals.md`](docs/evals.md) — all three surfaces in one place: metrics, trajectories, thresholds, and the lesson** *(start here)*
- [`docs/eval-trajectory.md`](docs/eval-trajectory.md) — contest-creation eval: prompt versions, metrics over time, committed thresholds
- [`docs/host-assistant-eval-trajectory.md`](docs/host-assistant-eval-trajectory.md) — host-assistant tool-use eval
- [`docs/infra-generation.md`](docs/infra-generation.md) — the AI-generated infrastructure surface (prompt → output → verification)

Want the guided tour? [`docs/demo-script.md`](docs/demo-script.md) walks the whole system in 15 minutes — both creation paths, the eval trajectory, the destructive-action confirmation, and the audit log.

## Architecture

```
   ┌──────────────────────────┐      ┌──────────────────────────┐
   │     HOST / ADMIN APP     │      │     PARTICIPANT APP      │
   │  forms + LLM chat panel  │      │  mobile-first; join by   │
   │  control room · audit log│      │  code · dish · score     │
   └────────────┬─────────────┘      └────────────┬─────────────┘
                │ httpOnly cookie                  │ httpOnly cookie
                │ (same-origin proxy)              │ (same-origin proxy)
                └───────────────┬──────────────────┘
                                ▼
                   ┌────────────────────────────────┐
   MCP client ────▶│          BACKEND API           │  single source of truth
   (host PAT,      │  authn/authz · ownership       │  and the ONLY authority
    over stdio)    │  rule compiler · audit log     │  on authorization
                   └────────────┬───────────────────┘
                                ▼
                             SQLite
```

> Full diagrams — system context, the three entry points, the authorization check, the propose→confirm→act sequence, the audit projection, packages, and deployment — are in [`docs/architecture.md`](docs/architecture.md).

**One backend API** is the source of truth and the sole authorization authority, with two scopes (host, voter). **Three entry points** reach it — the HTTP API, the **MCP server** (a thin protocol adapter with no business logic, speaking stdio to an MCP client and authenticating with a host-issued personal access token), and the in-app **chat assistant** (which re-enters the same routes, so every rule is enforced exactly once). Every action from any path lands in one **audit log** — a projection of domain events, tagged with its source and whether the host confirmed it.

**Destructive actions** (close, publish, reveal) are gated by an action-bound HMAC confirmation across three layers: the MCP server refuses to dispatch without a valid token, the in-app assistant surfaces a focus-trapped confirmation card, and the API records who confirmed it. A token for one action can never authorize another.

## AI surfaces

AI is integrated in three distinct places, each with the same discipline (schema-validate → re-validate → version → audit) and its own eval set:

1. **Contest-creation LLM** — turns natural language into a validated contest draft. Model output is structurally bounded (`additionalProperties: false`) and then **re-validated by the API**, which reads only known fields. A deterministic guard treats participant names as *data*: if a name tries to dictate a high-stakes rule, that rule is dropped and surfaced to the host as a clarification.
2. **Host-assistant LLM** — picks MCP tools in response to host requests; destructive tools require explicit confirmation before anything runs.
3. **AI-generated infrastructure** — Dockerfiles, compose, CI, and CD produced *and verified* as a project artifact ([`docs/infra-generation.md`](docs/infra-generation.md)).

## Engineering approach

- **DDD** — rich tactical modeling in the core (the rule space + pure compiler) in a `domain` package with zero I/O (lint-enforced); pragmatic elsewhere.
- **TDD / ATDD** — outside-in double loop: Gherkin `*.feature` acceptance specs (domain language only — the glossary as executable tests) over unit TDD. Acceptance tests run against real in-memory SQLite, faking only the LLM, clock, and notifications.
- **Security** (the degree's curriculum anchor) — ownership-checked authorization on every endpoint, bcrypt + hand-rolled HS256 tokens in httpOnly/Secure cookies, account lockout, parameterized SQL, injection defenses, rate limiting, secrets hygiene. Mapped to the OWASP Top 10 — with the gaps named honestly — in [`docs/threat-model.md`](docs/threat-model.md).
- **Accessibility** — WCAG 2.1 AA; the participant app is used live at a venue (one-handed, poor light, time pressure), so accessibility is core UX, not a compliance checkbox. axe (component + E2E) and a 320 px reflow test gate every PR; the pass, including what is *not* covered, is in [`docs/accessibility.md`](docs/accessibility.md).

## Tech stack

| Area | Choice |
|------|--------|
| Language | TypeScript everywhere |
| Monorepo | npm workspaces — `domain`, `api`, `mcp`, `host-web`, `participant-web`, `shared`, `ui`, `evals` |
| Backend | Node.js + Fastify (+ Helmet, CORS allowlist, rate limiting) |
| Frontends | React + Vite; **CSS custom properties + CSS Modules** over a shared design-token package |
| Persistence | SQLite via the built-in `node:sqlite` (Postgres-ready: migrations, no SQLite-only SQL) |
| AI | Provider-agnostic `LLMClient` over any OpenAI-compatible `/chat/completions` (local Ollama by default); MCP via the official SDK |
| Testing | Vitest + `vitest-cucumber` (Gherkin) + Playwright E2E with `axe-core` |
| Infra | Docker + compose (dev, and prod behind Caddy TLS), GitHub Actions CI/CD |

## CI/CD

[`ci.yml`](.github/workflows/ci.yml) runs three gates on every PR:

- **hard gate** — typecheck, lint, the full test suite, and the supply-chain audit (blocks on high/critical advisories not covered by a justified, expiring [allowlist](.audit-allowlist.json))
- **accessibility hard gate** — axe-core inside the Playwright E2E
- **threshold gate** — the eval suites, blocking only on a metric regression. It runs on schedule/dispatch, since a hosted runner has no model, and **skips cleanly rather than faking a pass**

[`cd.yml`](.github/workflows/cd.yml) builds and pushes the four images to GHCR on a `v*` tag, then validates the production manifest ([`docker-compose.prod.yml`](docker-compose.prod.yml)), which fronts the stack with Caddy for automatic TLS.

## Repository layout

```
openspec/              # spec-driven design (source of truth for the plan)
  changes/tapas-contest-app/
    proposal.md        # why + what
    design.md          # architecture, DDD, testing, security, accessibility
    tasks.md           # phased implementation plan + the build log
    glossary.md        # ubiquitous language
    worked-example.md  # end-to-end run
docs/                  # thesis artifacts: threat model, eval trajectories, infra generation
packages/              # the eight workspaces
  domain/  shared/  ui/  evals/              # libraries + eval harness
  api/  mcp/  host-web/  participant-web/    # services + apps
deploy/                # production edge (Caddyfile)
scripts/               # supply-chain audit gate
tests/e2e/             # whole-system E2E (Playwright), root-level
```

**Test layout.** `src/` holds source only. Each workspace has a sibling `tests/` with `unit/`, `integration/`, and `acceptance/` subfolders whose inner structure mirrors `src/` (e.g. `src/foo/bar.ts` → `tests/unit/foo/bar.test.ts`). Whole-system E2E lives at the repo-root `tests/e2e/`.

## Configuration

All configuration is environment variables, validated with Zod at startup — the process refuses to boot on missing or invalid config, and secrets are never logged. See [`.env.example`](.env.example) (local) and [`.env.prod.example`](.env.prod.example) (deploy).

Secrets must be **≥ 32 characters**, and in production the API refuses to start if `JWT_SECRET` or `ASSISTANT_CONFIRMATION_SECRET` is left at its committed dev default.
