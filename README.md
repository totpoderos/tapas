# Tapas

Create and run tapas contests — one backend API, two frontends, and an MCP-mediated AI host assistant.

Tapas is an AI-augmented app for organized tapas competitions: a host opens a contest with a theme and rules, cooks submit their dish, judges taste and score, and a winner is revealed at the end. It is built around a real recurring event but generalized into a small **rule space** the host configures and the system enforces.

> **Status:** spec / exploration phase. The design is driven with [OpenSpec](https://github.com/Fission-AI/OpenSpec) and lives in [`openspec/`](openspec/); implementation has not started yet. See the [proposal](openspec/changes/tapas-contest-app/proposal.md), [design](openspec/changes/tapas-contest-app/design.md), [tasks](openspec/changes/tapas-contest-app/tasks.md), and [glossary](openspec/changes/tapas-contest-app/glossary.md).

## The idea

A tapas contest is not one product but a point in a five-dimensional rule space:

- **Attribution** — per person or per couple
- **Anti-bias** — none, couples, or arbitrary no-score pairs
- **Scoring range** — fixed `1..10` or `1..N`
- **Uniqueness** — strict permutation or allow repeats
- **Categories** — configurable (e.g. Presentation, Originality, Taste)

The host expresses these choices; on **publish** they are *compiled* (a pure function, no I/O, no LLM) into a materialized constraint view that the runtime enforces — the rule language is never re-interpreted at runtime.

## Architecture

```
   ┌──────────────────────────┐      ┌──────────────────────────┐
   │     HOST / ADMIN APP     │      │     PARTICIPANT APP      │
   │  forms + LLM chat panel  │      │  mobile-first PWA        │
   │  (host scope)            │      │  join / dish / score     │
   └────────────┬─────────────┘      └────────────┬─────────────┘
                │ HTTPS                            │ HTTPS
                └───────────────┬──────────────────┘
                                ▼
                   ┌──────────────────────────┐
                   │        BACKEND API       │  source of truth
                   │  two authz scopes;       │  auth · validation
                   │  audit log; compiler     │  audit log
                   └────────────┬─────────────┘
                                ▼
                   ┌──────────────────────────┐
                   │        MCP SERVER        │  thin protocol adapter
                   │  exposes API as tools    │  (no business logic)
                   └──────────────────────────┘
```

**One backend API** (source of truth, two authorization scopes), **two frontends** (host/admin app + participant PWA), and **three entry points to the API** — HTTP, the MCP server, and the LLM chat assistant. Every action, from any path, lands in one **audit log** (a projection of domain events, tagged with its source).

## AI surfaces

AI is integrated in three distinct places, each governed by the same discipline (schema-validate → review → version → audit) and each with its own eval set:

1. **Contest-creation LLM** — turns natural language into a validated contest draft.
2. **Host-assistant LLM** — picks MCP tools in response to host requests; destructive tools require confirmation.
3. **AI-generated infrastructure** — Dockerfiles, CI/CD, and compose file produced and evaluated as a project artifact.

## Engineering approach

- **DDD** — rich tactical modeling in the core (the rule space + compiler) in a pure `domain` package; pragmatic elsewhere.
- **TDD / ATDD** — outside-in double loop: Gherkin `*.feature` acceptance specs (domain language only) over unit TDD. Acceptance tests run against real SQLite.
- **Security** (the degree's curriculum anchor) — OWASP-mapped: role + ownership authorization, JWT-in-httpOnly-cookies, injection defenses, rate limiting, secrets hygiene.
- **Accessibility** — WCAG 2.1 AA; the participant app is used live at a venue, so accessibility is core UX.

## Tech stack

| Area | Choice |
|------|--------|
| Language | TypeScript everywhere |
| Monorepo | npm workspaces — `domain`, `api`, `mcp`, `host-web`, `participant-web`, `shared`, `ui` |
| Backend | Node.js + Fastify |
| Frontends | React + Vite + Tailwind (participant app is a PWA) |
| Persistence | SQLite for v1 (Postgres-ready) |
| Testing | Vitest + `vitest-cucumber` (Gherkin) + Playwright (E2E, axe-core) |
| LLM | Provider-agnostic `LLMClient` (concrete provider TBD) |

## Repository layout

```
openspec/            # spec-driven design (source of truth for the plan)
  changes/tapas-contest-app/
    proposal.md      # why + what
    design.md        # architecture, DDD, testing, security, accessibility
    tasks.md         # phased implementation plan
    glossary.md      # ubiquitous language
    worked-example.md# end-to-end run (also the demo script)
```

The codebase (the seven workspaces above) is created in Phase 0 of the plan.
