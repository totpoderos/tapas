# Proposal: Tapas Contest App

## Why

A web and mobile app to **create and run tapas contests** and **participate as cook or judge**. The core loop: a host opens a contest with theme and rules, cooks submit their dish, judges taste and score, and a winner is revealed at the end.

This proposal is the result of an exploration that started from a real, recurring contest: 10 friends, 4 couples and 2 singles, each preparing one tapa, scoring in three categories (Presentation, Originality, Taste). The exploration surfaced two things that shape this proposal.

**First, the domain is more rule-shaped than it looks.** A tapas contest is not a single product; it is a small space of variants along five dimensions: dish attribution (per person or per couple), anti-bias relations (none, couples, or arbitrary no-score pairs), scoring range (fixed 1..10 or 1..N per voter), uniqueness of scores per category (strict permutation or allow repeat), and category configuration. The product is a system that lets a host *express those choices* and then *enforces them*.

**Second, the LLM is a general host assistant, not a form-filler.** The host can create, configure, and manage a contest through the host app *or* by chatting with an AI assistant that acts on the contest through standardized tool calls. The same backend operations are exposed three ways: to humans via the frontends, to LLMs via an MCP server, and to other services via HTTP. The AI assistant picks tools, the MCP server executes them through the API, and the audit log records every action regardless of which path triggered it.

## Context

### The recurring event this is built around

10 friends meet once a year. They prepare tapas. They taste and score. They reveal a winner. The variant we are building for is the *organized event* shape: 20–50 people, same venue, semi-live voting on phones.

### Variations we are explicitly designing for

The system supports a rule space, not a single contest. The first three variants are:

| Variant | People | Dishes | Attribution | Anti-bias | Range | Unique |
|---|---|---|---|---|---|---|
| **Strict** (current practice) | 10 | 10 | per person | couples | 1..N | yes |
| **Permissive** (this year's plan) | 10 | 10 | per person | couples | 1..10 | no |
| **Joint** (colleague's practice) | 10 | 6 | per couple | couples | 1..10 | no |

A host picks a configuration along these dimensions when creating a contest.

### Roles

- **Host** — creates the contest, controls reveal, sees tallies. The host's AI assistant acts on the host's behalf through MCP.
- **Cook** — submits a dish. Also a judge.
- **Judge** — scores dishes. In organized events, attendees who did not cook are still judges.

### The dish explanation

At the tasting, the cook explains the dish to the room — ingredients, technique, story. This is part of the contest; it is why the cook's name is visible to judges. The system does not capture or replace the explanation. It stays in the room.

### Out of scope (v1)

- Anonymous judging (the name is part of the contest; we will not design around it).
- Course assignment (starter / main / dessert).
- Public / distributed contests.
- Recipe sharing, social feeds.
- Payment / ticketing.
- Multi-tenant organizations.
- Edit-after-send (a sent vote is final; host-unlock is a v2 feature).
- Anonymous until reveal (a v2 feature; would not require a model change).
- Category weights (out of v1 by design; reintroducible later without a model change).

## What we are building (v1)

A web-first, mobile-capable product for organized tapas events. **One backend API, exposing two authorization scopes (host and voter). Two frontends (host/admin app and participant app). Three entry points to the API: HTTP, MCP server, chat assistant.** The same business operations, the same audit log, the same authorization rules.

### The architectural picture

```
   ┌──────────────────────────────┐   ┌──────────────────────────────┐
   │        HOST / ADMIN APP      │   │        PARTICIPANT APP       │
   │  (Web UI, host + admin)      │   │  (mobile-first PWA, voters)  │
   │  - contest create/manage     │   │  - join by code              │
   │    (forms)                   │   │  - submit dish               │
   │  - chat panel (LLM-mediated) │   │  - score screen              │
   │  - tally, reveal control     │   │  - reveal view               │
   │  - calls API (host scope)    │   │  - calls API (voter scope)   │
   └──────────────┬───────────────┘   └───────────────┬──────────────┘
                  │ HTTPS                              │ HTTPS
                  └───────────────┬────────────────────┘
                                  ▼
                 ┌──────────────────────────────────┐
                 │           BACKEND API            │
                 │  - contests, drafts, scores      │
                 │  - two authz scopes:             │
                 │      host-only / voter-scoped    │
                 │  - auth, validation              │
                 │  - audit log                     │
                 │  - source of truth               │
                 └────────────┬─────────────────────┘
                              │
                              │ same operations
                              ▼
                 ┌──────────────────────────────────┐
                 │          MCP SERVER              │
                 │  - exposes API as MCP tools      │
                 │  - thin adapter, no business     │
                 │    logic of its own              │
                 │  - called by:                    │
                 │    * the chat panel in host app  │
                 │    * external MCP clients        │
                 └──────────────────────────────────┘
```

The MCP server is a *protocol adapter*. It does not duplicate the API. It does not have its own database access. When a tool is called, the MCP server translates the call into an HTTP request to the backend API, then returns the result. The audit log records the call as having come from `sourcePath: "mcp"`.

### Capabilities

1. **`create-contest`** — Create contest, by form or by chat. A host chooses a structured form or a natural-language path. Both produce the same `ContestDraft` shape. The LLM is given a constrained function schema; the schema is the security boundary. The form path is the host app. The chat path is the MCP-mediated LLM.
2. **`configure-contest`** — Configure the contest, by form or by chat. After creation, the host can edit attribution, anti-bias mode, scoring config, close rule, reveal strategy — by editing fields in the host app *or* by asking the LLM to do it ("actually, let's allow repeat scores and use 1..10"). Both paths go through the same draft-mutation API.
3. **`validate-and-publish-contest`** — Validate and publish. A draft is reviewed and validated; on publish, the rule language is *compiled* into a materialized constraint view. The runtime never re-interprets the rule language.
4. **`enroll-participants`** — Enroll participants. The host lists the expected participants when setting up the contest (no accounts — just names and pairings); publishing turns that list into a roster of open *places*. At the venue, each person enters the join code and **claims their place** by name, which links them to the participant the scoring rules already know. A place can be claimed only once. (Late-comers not on the roster, and host-side add/remove during a live contest, are a later capability.)
5. **`submit-dishes`** — Submit dishes. Cooks register their dish (name, optional description, optional photo) during the contest.
6. **`taste-and-score`** — Taste and score. Judges score dishes during the event. Scores are saved locally and edited freely until sent. On send, the vote is locked.
7. **`manage-live-contest`** — Manage the live contest. The host can see tallies, send reminders, extend the deadline, lock the contest, trigger the reveal — through the host app or by asking the LLM. The LLM picks the right tool, the MCP server executes it through the API.
8. **`reveal-results`** — Reveal results. The host triggers the reveal; winners are announced globally and per category. The host resolves ties.
9. **`audit-everything`** — Audit everything. Every change to a draft, every publish, every score, every MCP tool call, every reveal is logged with who, when, and from which path (form, MCP, or system). MCP-mediated actions are explicitly tagged.
10. **`host-authentication`** — Hosts and admins authenticate with email + password. Sessions are a JWT access token (15m) + refresh token (7d) in httpOnly + Secure + SameSite cookies, with refresh rotation and revocation on logout; repeated failed logins lock the account.
11. **`host-access-tokens`** — A signed-in host can issue a personal access token for an external client (the MCP server) to act as them without their password, and revoke it later. A token resolves to the same identity and authorization checks as the host's own session.
12. **`response-hardening`** — Every API response carries baseline security protections (Helmet headers, a restrictive CORS allowlist for the two frontend origins, forced HTTPS in production, generic errors in production that never leak internals) and sensitive entry points are rate-limited.
13. **`security-event-logging`** — The API keeps a forensic log of authentication activity (sign-in success/refusal with reason, personal-access-token issued/used), stamped with actor, source, and time, and never containing a password or full token.
14. **`contest-management-api`** — A signed-in host drives a contest's early life over the API end-to-end: save a draft, list/rename/discard it, publish it into a live contest, and read that contest — every operation refused when not signed in, and scoped to the host's own work.

### Architectural thesis

> *The same business operations are exposed three ways — to humans via the frontends (host app and participant app), to LLMs via MCP, and to other services via HTTP — and the audit log is the same in all three paths. The MCP server is a protocol adapter, not a separate code path.*

The LLM's role is to *translate host intent into tool calls*. The MCP server's role is to *execute those tool calls as API requests*. The API's role is to *enforce invariants, validate, and write to the audit log*. Each layer does one thing.

### The LLM surface, in plain terms

The LLM is a *host's AI assistant*. Its job is to act on the host's behalf. The host can ask it to:

- "Create a tapas contest for 10 friends, 4 couples, score 1 to 8 with no repeats"
- "Add María as a participant"
- "Bump the deadline 30 minutes — Sara's train was delayed"
- "What does the tally look like?"
- "Send a reminder to the three people who haven't voted"
- "Switch to allow-repeat scores and a 1..10 range"
- "Trigger the reveal"

Each of these is translated by the LLM into one or more MCP tool calls. The MCP server executes them. The API authorizes and writes. The audit log records.

Some tool calls are *read-only* (look up tally). Some are *configuration* (add participant, edit draft). Some are *destructive* (delete a contest, trigger reveal). Destructive tools require explicit host confirmation in the chat UI, surfaced as a clear "Confirm: trigger reveal for Summer Tapas 2026?" beat. The MCP server marks which tools are destructive; the chat UI enforces the confirmation; the API enforces authorization.

### Security stance

- **Schema is the first security boundary.** The LLM cannot produce fields outside the function schema. `additionalProperties: false` is a structural injection defense, not a stylistic choice.
- **Auth at every layer, verified in the backend.** Three roles (`admin`, `host`, `voter`). Authorization checks **ownership**, not just role (OWASP A01). Hosts/admins authenticate with email + password (bcrypt 12+), issued a **JWT access token (15m) + refresh token (7d) in httpOnly + Secure + SameSite cookies**. External MCP clients use a **host-issued personal access token** (bearer). The MCP server makes no authorization decisions of its own; the API does.
- **Two-phase input validation.** LLM output is parsed into a typed object by the schema (structural), then validated by the draft service (authoritative, Zod). Belt and braces. Env config is Zod-validated at startup (fail-fast).
- **Destructive tools require confirmation.** The MCP server marks destructive tools; the chat UI enforces explicit host confirmation before the call lands. The API has a separate authorization check independent of the UI.
- **No secrets in prompts.** Host instructions, participant names, and contest config are *not* sent to the LLM as part of system prompts. The LLM sees only the host's current message, the tool definitions, and the prior turns in the conversation. Secrets live in env vars, never in code, logs, error messages, or URLs.
- **Standard web hardening.** HTTPS + HSTS; Helmet security headers; restrictive CORS allowlist (never `*`); rate limiting on login, join-by-code, and destructive tools; parameterized SQL; generic errors in production; `npm audit`/Dependabot for supply chain.
- **Shift-left.** Validation, auth, and audit logging are designed in from day one, not retrofitted. This is the degree's "security" curriculum anchor — the design maps each measure to the OWASP Top 10 (see `design.md §11B`).

### AI as a curriculum anchor

The LLM is the *center* of the project, not a side feature. The defense will demonstrate:

1. **A 25-case eval set for the contest-creation LLM** — measures schema validity, field accuracy, missing-field recall, false-field rate (adversarial inputs).
2. **A 30+ case eval set for the host-assistant LLM** — measures tool selection accuracy, tool argument correctness, and tool-chaining behavior. The harder, more interesting eval.
3. **An AI-generated infrastructure story** — Dockerfiles, CI pipeline, and compose file generated by AI, versioned in the repo, with a clear audit trail of what was asked, what was produced, and how it was verified. This is the *third* AI surface in the project.

The thesis the committee will hear:

> *AI is integrated into this product in three distinct places, all governed by the same discipline: schema-validate the LLM's output, review it before it acts, version the artifacts, audit every action. The system is AI-augmented, not AI-dependent: every AI-mediated action has a non-AI path, and the audit log is the same in both.*

## Tech shape

- **Frontends (two apps).** React + TypeScript, Vite, Tailwind, sharing a common component/library layer.
  - **Host/admin app** — desktop-and-mobile responsive. Contest create/manage forms, tally, reveal control, and the chat panel as a first-class UI surface, showing the LLM's *actions*, not just its final answer. Calls the API with the host scope.
  - **Participant app** — mobile-first, PWA-installable. Join by code, submit dish, score screen, reveal view. Calls the API with the voter scope.
- **Backend.** Node.js + TypeScript, Fastify. SQLite for v1 (single machine, no ops), Postgres-ready.
- **MCP server.** A thin adapter that exposes the backend API as MCP tools. Calls the API over HTTP; no business logic of its own. The tool definitions are the integration contract.
- **LLM.** Provider-agnostic interface. Default: a hosted model with tool-calling support. The MCP tool definitions are the integration contract.
- **Persistence.** SQL with migrations. JSON columns for the materialized constraint view, the MCP tool-call audit log payload, and the chat transcript.
- **Realtime.** Polling for tallies. Refresh on reveal. The chat panel uses polling or SSE; websockets are not required in v1.
- **Auth.** Host: email + password (or magic link). Participants: join code + display name + remember-me token, scoped to a single contest. MCP server is bound to a host session at the protocol level.
- **Deployment.** Cloud-shaped: Vercel for the two frontends, a managed Postgres for the database, the LLM via a hosted provider. The whole thing must be runnable locally with `docker compose up` for the defense demo. The Dockerfiles and the compose file are *generated by AI as a thesis artifact* — they are not the code under test, they are an *output* of the AI work the project demonstrates. The pipeline (CI: build, test, eval; CD: deploy on tag) is also an AI-generated artifact, versioned in the repo.

## Open threads (resolved)

1. **Reveal strategy.** ✓ Both host-trigger and scheduled are supported in v1.
2. **Participant join.** ✓ Join code only, in v1.
3. **LLM defaults.** ✓ The LLM may propose values for fields the host did not mention, with a clearly-marked "LLM-suggested" badge in the form.
4. **MCP exposure.** ✓ The MCP server is internal (powers the chat panel) and external (any MCP client can connect, with the host's credentials). One server, one tool surface.
5. **Deployment.** ✓ Cloud-shaped with a `docker compose up` local path. AI-generated infrastructure is itself a defense artifact.

## Status

This is a **committed proposal**. The architectural thesis is set: one backend API with two authorization scopes (host, voter), two frontends (host/admin app, participant app), three entry points to the API (HTTP, MCP server, chat assistant), one audit log, one authorization model. The MCP server is a protocol adapter. The LLM is a general host assistant with a toolbelt. The chat UI shows the LLM working, not just its answers.

The next pass is implementation, sequenced in `tasks.md`. The defense's load-bearing artifacts are:

- **The compiler** — 50+ unit tests, deterministic, no I/O.
- **The contest-creation eval harness** — 25 cases, four metrics, prompt iteration trajectory.
- **The host-assistant eval harness** — 30+ cases, tool-selection accuracy, tool-argument correctness, tool-chaining.
- **The audit log** — every action attributable to form, MCP, or system, with full before/after.
- **The AI-generated infrastructure** — Dockerfiles, CI pipeline, compose file, with their own eval and audit trail.
- **The demo** — 15 minutes, the worked example end-to-end, MCP-mediated actions visible in the chat panel.
