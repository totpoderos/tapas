# Design: Tapas Contest App

> The system is shaped by two architectural decisions. **First**, the rule language is consulted at *publish* time, never at *runtime*. **Second**, the backend API is the source of truth; the MCP server is a thin protocol adapter; the two frontends (host/admin app and participant app) and the chat assistant are consumers of the same API. This document describes what flows through those boundaries and why.

## 1. The system, end to end

```
   ┌──────────────────────────┐      ┌──────────────────────────┐
   │     HOST / ADMIN APP     │      │     PARTICIPANT APP      │
   │                          │      │  (mobile-first PWA)      │
   │  - contest create/manage │      │  - join by code          │
   │    forms                 │      │  - submit dish           │
   │  - tally                 │      │  - score screen          │
   │  - reveal control        │      │  - reveal view           │
   │  - chat panel  ──┐       │      │                          │
   │                  │       │      │  calls API (voter scope) │
   │  calls API       │       │      │                          │
   │  (host scope)    │       │      │                          │
   └────────┬─────────┼───────┘      └────────────┬─────────────┘
            │ HTTPS    │ MCP                       │ HTTPS
            │          ▼                           │
            │   ┌──────────────┐                   │
            │   │ Chat Assistant│                  │
            │   │ LLM picks     │                  │
            │   │ tools; destr. │                  │
            │   │ tools confirm │                  │
            │   └──────┬───────┘                   │
            │          │ MCP                        │
            ▼          ▼                            ▼
   ┌─────────────────────────────────────────────────┐
   │              BACKEND API                        │
   │                                                 │
   │  - contests, drafts, dishes, scores             │
   │  - two authz scopes: host-only / voter-scoped   │
   │  - DraftService, ContestCompiler, ContestSvc    │
   │  - auth, validation, audit log                  │
   │  - source of truth                              │
   └────────────────────────┬────────────────────────┘
                            │ HTTPS
                            ▼
   ┌─────────────────────────────────────────────────┐
   │              MCP SERVER                         │
   │                                                 │
   │  - exposes API operations as MCP tools         │
   │  - thin protocol adapter                       │
   │  - no business logic of its own                 │
   │  - same host identity, same audit path          │
   │                                                 │
   │  Consumer: chat assistant + external clients    │
   └─────────────────────────────────────────────────┘
                            │
                            │ tool call
                            ▼
                       BACKEND API
                            │
                            ▼
                       AUDIT LOG
```

**The MCP server is a thin adapter over the backend API.** When a tool is called, the MCP server translates the call into an HTTP request to the backend API and returns the result. It does not access the database directly. It does not have its own validation. The business logic lives in one place: the API.

## 2. User flows

### 2.1 Contest creation — two paths, one source

```
   HOST                    WEB UI                  CHAT                  BACKEND
    │                         │                      │                       │
    │ create via form         │                      │                       │
    ├────────────────────────▶│                      │                       │
    │                         │  POST /drafts        │                       │
    │                         ├──────────────────────┼──────────────────────▶│
    │                         │                      │                       │
    │                         │◀─────── draft ───────┼───────────────────────┤
    │                         │                      │                       │
    │ review, edit, publish   │                      │                       │
    ├────────────────────────▶│                      │                       │
    │                         │  POST /contests      │                       │
    │                         ├──────────────────────┼──────────────────────▶│
    │                         │                      │                       │
    │ create via chat         │                      │                       │
    ├─────────────────────────┼─────────────────────▶│                       │
    │                         │                      │  LLM picks            │
    │                         │                      │  create_draft tool    │
    │                         │                      │                       │
    │                         │                      │  POST /drafts         │
    │                         │                      ├──────────────────────▶│
    │                         │                      │                       │
    │                         │                      │◀───── draft ──────────┤
    │                         │                      │                       │
    │                         │  chat shows draft    │                       │
    │                         │  "Here's what I      │                       │
    │                         │   understood..."     │                       │
    │◀────────────────────────┼──────────────────────┤                       │
    │                         │                      │                       │
    │ "looks good"            │                      │                       │
    ├─────────────────────────┼─────────────────────▶│                       │
    │                         │                      │  publish_contest      │
    │                         │                      ├──────────────────────▶│
    │                         │                      │                       │
    │                         │                      │  compile, materialize │
    │                         │                      │                       │
    │◀────────────────────────┼──────────────────────┼──── join code ────────┤
    │                         │                      │                       │
```

### 2.2 Live contest management — the host's AI assistant

```
   HOST                    CHAT                  MCP                 BACKEND
    │                         │                   │                       │
    │ "What does the tally    │                   │                       │
    │  look like?"            │                   │                       │
    ├────────────────────────▶│                   │                       │
    │                         │  get_tally        │                       │
    │                         ├──────────────────▶│                       │
    │                         │                   │  GET /contests/.../tally│
    │                         │                   ├──────────────────────▶│
    │                         │                   │                       │
    │                         │                   │◀────── tallies ────────┤
    │                         │                   │                       │
    │                         │  3 haven't voted  │                       │
    │                         │◀──────────────────┤                       │
    │                         │                   │                       │
    │ "Send them a reminder"  │                   │                       │
    ├────────────────────────▶│                   │                       │
    │                         │                   │                       │
    │                         │  "I'll send a     │                       │
    │                         │   reminder to:    │                       │
    │                         │   María, Juan,    │                       │
    │                         │   Sara. Confirm?" │                       │
    │                         │                   │                       │
    │ "yes"                   │                   │                       │
    ├────────────────────────▶│                   │                       │
    │                         │  send_reminder    │                       │
    │                         ├──────────────────▶│                       │
    │                         │                   │  POST /reminders       │
    │                         │                   ├──────────────────────▶│
    │                         │                   │                       │
    │                         │                   │                       │
    │                         │                   │  (destructive tool    │
    │                         │                   │   check + authz)      │
    │                         │                   │                       │
    │                         │                   │◀─────── 3 sent ────────┤
    │                         │                   │                       │
    │                         │  "Done. 3 sent."  │                       │
    │                         │◀──────────────────┤                       │
    │                         │                   │                       │
```

## 3. The compile boundary (unchanged)

```
                    ┌────────────────────────────────────┐
                    │           ContestDraft             │
                    └─────────────────┬──────────────────┘
                                      │
                                      │  publish()
                                      ▼
   ┌────────────────────────────────────────────────────────────┐
   │                      COMPILER                             │
   │  PURE FUNCTION. No I/O. No LLM.                           │
   │  inputs:   ContestDraft                                    │
   │  outputs:  MaterializedContest                             │
   └─────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────────────────┐
                    │           Contest (live)           │
                    │  - materialized dishes             │
                    │  - materialized constraint view    │
                    │  - immutable history begins        │
                    └────────────────────────────────────┘
```

The rule language is GONE from this point. Runtime only checks against the materialized view.

## 4. Data model (unchanged from prior version)

```
Person
  id, displayName
  partnerId?         PersonId           // couples mode
  noScoreWith?       PersonId[]         // arbitrary_pairs mode

Contest
  id, name, theme?
  hostId             PersonId
  status             "draft" | "scheduled" | "live" | "scoring" | "closed"
  attribution        "per_person" | "per_couple"
  antiBias           "none" | "couples" | "arbitrary_pairs"
  scoring            ScoringConfig
  closeRule          CloseRule
  revealStrategy     RevealStrategy
  joinCode           string
  createdAt, publishedAt?, closedAt?, revealedAt?

ScoringConfig
  categories         Category[]
  range              { min, max }
  uniquePerCategory  boolean

Category
  id, name           // no weight in v1

CloseRule
  when               "all_sent" | "host_trigger" | { scheduled }

RevealStrategy
  when               "host_trigger" | { scheduled }

Dish
  id, contestId
  displayName
  description?, photoUrl?
  submitterIds       PersonId[]
  course?            string   // unused in v1, kept for forward compat

VoteSession
  id, contestId, voterId
  status             "draft" | "sent"
  createdAt, submittedAt?
  UNIQUE (contestId, voterId)

Score
  id, voteSessionId, dishId, categoryId
  value              number
  createdAt, updatedAt
  UNIQUE (voteSessionId, dishId, categoryId)

MaterializedContest (JSON blob on Contest row, generated by compiler)
  dishes[]                Dish[]
  allowedVoters           Map<DishId, Set<PersonId>>
  validScoreRange         Map<(PersonId, CategoryId), [min, max]>
```

## 4A. Domain design (DDD)

The domain is **not uniformly rich**. There is a dense, rule-shaped core (the config rule space + the compiler) surrounded by comparatively CRUD-ish activity (enrollment, dish submission, scoring writes). The DDD stance is therefore: **rich tactical DDD in the core, pragmatic service-oriented style elsewhere.** Invest modeling effort where the complexity is.

### 4A.1 Context map (4 bounded contexts)

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   CONTEST AUTHORING (CORE)   │     │      LIVE SCORING            │
│                             │     │                             │
│  Draft, ContestConfig,       │ ──▶ │  Enrollment, Dish,          │
│  rule space, compile()       │pub  │  VoteSession, Score,        │
│  → MaterializedContest       │lish │  runtime checks vs.         │
│                             │     │  materialized view          │
│  RICH DOMAIN. Pure.         │     │  Consistency-heavy.         │
└─────────────────────────────┘     └──────────────┬──────────────┘
                                                    │ close
                                                    ▼
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   ASSISTANT (SUPPORTING)     │     │   RESULTS & REVEAL           │
│                             │     │                             │
│  LLM extraction,             │     │  Tally, winners per         │
│  host-assistant tool select, │     │  category, tie resolution,  │
│  MCP adapter                 │     │  reveal                     │
│  Generic/technical.          │     │  Pure tally fn + policy.    │
└─────────────────────────────┘     └─────────────────────────────┘

     AUDIT — cross-cutting, a projection of domain events (see §5)
```

- **Contest Authoring (core, rich).** The rule space lives here as value objects; `compile()` is the domain's centerpiece. Full tactical DDD.
- **Live Scoring (consistency-heavy).** Aggregates enforce invariants at write time; lighter modeling otherwise.
- **Results & Reveal (supporting).** A pure `tally()` function plus a tie-resolution policy.
- **Assistant (supporting/generic).** LLM + MCP adapter. No business logic of its own; it translates intent into calls against the other contexts.

### 4A.2 Aggregates & consistency boundaries

- **Draft** (root) — mutable, pre-publish. Its own aggregate; retired at publish.
- **Contest** (root) — created by `publish(draft)`; holds the immutable `MaterializedContest`. `ScoringConfig` is a value object, not editable after publish.
- **VoteSession** (root, contains `Score` entities) — the real consistency boundary: uniqueness per `(dish, category)`, range validity against the materialized view, and the `draft → sent` lock invariant all enforced here.
- **Participant/Person** (root) — with couple / no-score relations.
- **Dish** (root) — referenced by scores; submitted during the live contest.

### 4A.3 Value objects (the rule space)

`ScoringConfig`, `Range`, `Attribution`, `AntiBias`, `Category`. These carry the "always valid" invariants and are the compiler's inputs. They are immutable and equality-by-value.

### 4A.4 Placement

The pure domain lives in a dedicated **`domain`** workspace — compiler, value objects, aggregates, `tally()`, and the **domain event definitions**. It has **zero I/O dependencies** (no DB, no LLM, no network); this is an enforceable rule, not a convention. `api` and `mcp` depend on `domain`. DTOs and the `LLMClient` interface stay in `shared`, kept separate from the pure domain.

The **ubiquitous language** is fixed in `glossary.md`: the same terms name the code, the API, the MCP tools, and the eval cases.

## 5. The audit log (a projection of domain events)

Every state change in every context **emits a domain event**. The audit log is a **projection of that event stream** — not a set of scattered `auditLog.record(...)` calls. This is why "the audit log is the same across all three paths" is structurally true rather than a discipline we hope to maintain: the event is emitted by the domain, and the projection records it regardless of whether the call originated from a form, from MCP, or from the system. A forgotten `record()` call cannot create a gap, because there are no `record()` calls to forget.

```
DomainEvent (emitted by aggregates in every context)
  id, contestId
  actorId            PersonId (host, voter, or "system")
  type               string        // e.g. "draft.saved", "vote.sent"
  before?, after?    JSON          // aggregate state delta
  occurredAt         ISO timestamp

AuditEntry (a projection of DomainEvent, enriched with request-path metadata)
  ...all DomainEvent fields, plus:
  sourcePath         "form" | "mcp" | "system"
  toolName?          string        // present when sourcePath="mcp"
  toolArgs?          JSON          // present when sourcePath="mcp"
  confirmation?      "host" | "auto"   // destructive tools only
```

The `sourcePath`, `toolName`, `toolArgs`, and `confirmation` fields are **request-path metadata** — they describe *how* an event was triggered, which the pure domain does not know. They are attached by the application layer (the request handler / MCP adapter) as it projects the event into an `AuditEntry`. The domain stays pure; the projection carries the security-relevant context.

The `sourcePath` field is the part that ties LLM to security. It is what makes "what did the LLM do?" answerable in a single query. When the path is `mcp`, `toolName` and `toolArgs` are recorded verbatim, so "the LLM called `send_reminder` with these recipients" is queryable.

The `confirmation` field is set to `"host"` when the action required explicit host confirmation in the chat UI, and `"auto"` when it did not. This is the audit trail that says "the host approved this destructive action."

## 6. The MCP tool surface

The MCP server exposes the backend API as a set of tools. Each tool has:

- A name
- A description (shown to the LLM)
- An input schema (typed, with `additionalProperties: false` — injection defense)
- A destructive flag (set on tools that mutate state in irreversible or noisy ways)
- An authorization scope (what host identity is required)

### 6.1 Tool catalog (v1)

```
DRAFT MANAGEMENT
  create_draft              creates a new ContestDraft (host-only)
  update_draft              updates fields on an existing draft (host-only)
  get_draft                 reads the current draft (host-only)
  publish_contest           publishes the draft, runs the compiler (host-only, destructive)
  list_my_contests          lists contests the host owns (host-only)

PARTICIPANT MANAGEMENT
  add_participant           adds a participant to a contest (host-only)
  remove_participant        removes a participant (host-only, destructive)
  list_participants         lists participants

DISH MANAGEMENT (cooks)
  submit_dish               a cook submits a dish (voter-scoped)
  list_dishes               lists dishes in a contest (host or voter)

SCORING (judges)
  start_vote_session        opens a draft vote session for a voter (voter-scoped)
  save_score                saves a score in a draft session (voter-scoped)
  send_vote                 locks the session (voter-scoped, destructive — no edit after)

CONTEST MANAGEMENT (host, live)
  get_tally                 reads tallies (counts of draft/sent sessions) (host-only)
  send_reminder             sends a reminder to pending voters (host-only, destructive)
  extend_deadline           pushes back the close time if scheduled (host-only)
  close_contest             forces close (host-only, destructive)
  trigger_reveal            triggers the reveal (host-only, destructive)
  resolve_tie               host picks the winner on a tie (host-only, destructive)

READ-ONLY (any host or voter, as appropriate)
  get_contest               reads a contest's public state
  get_results               reads the final results (after reveal)
```

### 6.2 Two example tool definitions

```
{
  name: "add_participant",
  description: "Add a participant to a contest. The participant joins with a display name and (optionally) a partner. If a partner is named, the anti-bias rule 'couples' is assumed.",
  destructive: false,
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      contestId: { type: "string" },
      displayName: { type: "string" },
      partnerDisplayName: { type: "string" }
    },
    required: ["contestId", "displayName"]
  }
}

{
  name: "send_reminder",
  description: "Send a reminder to participants who have not yet sent their votes. Use this when the host wants to nudge pending voters.",
  destructive: true,         // noisy action; 30 notifications is a lot
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      contestId: { type: "string" },
      onlyToPending: { type: "boolean", default: true }
    },
    required: ["contestId"]
  }
}
```

The `additionalProperties: false` is a structural injection defense. The `destructive: true` is what triggers the confirmation flow in the chat UI.

### 6.3 The MCP server's job

The MCP server is thin. Its implementation, for each tool, is roughly:

```ts
async function callTool(name, args, hostSession) {
  // 1. Verify the host session is valid (delegated to the API).
  // 2. Map (name, args) to an HTTP request against the API.
  // 3. Make the request with the host's auth token.
  // 4. Return the response, or the error, to the LLM.
}
```

The MCP server does *not*:
- Access the database directly
- Re-validate business rules
- Make authorization decisions (the API does that)
- Compute aggregations

It is a *protocol adapter*. The thesis implication: if the API changes, the MCP server's tool list changes. There is no parallel code path to maintain.

## 7. The chat assistant

The chat assistant is the host/admin app's *chat panel*. It is an LLM-mediated interface to the same MCP tools any other client could call. (It lives only in the host app; the participant app has no chat panel.) Its UX is:

```
┌──────────────────────────────────────────────────────────────┐
│  CHAT — Summer Tapas 2026                                    │
│                                                              │
│  You: Bump the deadline 30 minutes — Sara's train delayed.   │
│                                                              │
│  Assistant: I'll extend the close by 30 minutes.             │
│             → calling: extend_deadline (auto)                │
│             → result: close moved from 22:00 to 22:30        │
│                                                              │
│  You: Send a reminder to anyone who hasn't voted.            │
│                                                              │
│  Assistant: 3 participants haven't voted:                    │
│             María, Juan, Sara.                                │
│             → calling: send_reminder (destructive)            │
│             → Confirm? [Yes, send] [Cancel]                  │
│                                                              │
│  You: Yes.                                                   │
│                                                              │
│  Assistant: Done. 3 reminders sent.                           │
│             → calling: send_reminder (destructive, confirmed) │
│             → result: 3 sent, 0 failed                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

The key design choice: **the chat shows the tool calls and their results**, not just the LLM's prose. The user sees *what the LLM is doing* and can correct it. This is the same principle as the draft review surface in form-mode — the user is always in the loop.

### 7.1 Confirmation flow for destructive tools

When the LLM picks a destructive tool, the chat UI does not call it. It returns a confirmation card:

```
┌──────────────────────────────────────────────┐
│  ⚠ Confirm: send_reminder                    │
│                                              │
│  Contest: Summer Tapas 2026                   │
│  Recipients: 3 pending voters                 │
│                                              │
│  [Yes, send]  [Cancel]                       │
└──────────────────────────────────────────────┘
```

On confirmation, the chat UI calls the tool through the MCP server. The audit log records `confirmation: "host"`.

The MCP server *also* checks `destructive` and *also* requires confirmation at the protocol level. This is defense in depth: the chat UI enforces it for usability, the MCP server enforces it for security, and the API has its own authorization check independent of both. Any one of them being broken does not compromise the system.

### 7.2 What the LLM sees

The LLM is given:
- The system prompt (defines the assistant's role, lists the available tools, lists which are destructive)
- The user's current message
- The previous turns of the conversation
- The list of MCP tool definitions (so it knows what tools exist and their input schemas)

The LLM is *not* given:
- Other users' data
- Other contests
- The host's password or auth token
- The LLM provider's API key (that's the server's secret)

The LLM is *given on a need-to-know basis*:
- The contest state, when a tool call needs it (e.g., `get_tally` returns it)
- The list of participants, when `send_reminder` is called (the tool returns them as part of the response)

## 8. The two-phase flow for the contest-creation chat

The contest-creation chat is a *special case* within the chat assistant. It produces a `ContestDraft`, not a tool call. The flow is:

```
   host: "Mediterranean fusion, 8 cooks, partners allowed,
          three-criteria scoring, reveal at 22:00."

   ┌────────────────────────────────────────────────────────┐
   │  PHASE 1 — EXTRACT                                     │
   │  Input: free-form host message                         │
   │  Output: partial ContestDraft, with `?` markers        │
   │          for fields the LLM couldn't determine         │
   │                                                        │
   │  LLM is told: "If a field has a sensible default       │
   │  (e.g., contest name from theme, scoring categories    │
   │  from 'three-criteria'), include it. Mark it with      │
   │  `source: "llm_default"`. For fields with no defensible│
   │  default, leave them out and list them in              │
   │  `clarifications`."                                    │
   └────────────────────────┬───────────────────────────────┘
                            │
                            ▼
   ┌────────────────────────────────────────────────────────┐
   │  PHASE 2 — DRAFT                                        │
   │  Input: extracted draft + clarifications + host reply  │
   │  Output: complete ContestDraft, schema-valid           │
   │                                                        │
   │  Backend validates. If still missing fields,           │
   │  return to host with friendly list. If valid, show     │
   │  the draft in the form for review.                     │
   │                                                        │
   │  In the form, fields tagged `source: "llm_default"`    │
   │  are rendered with a "LLM-suggested" badge.            │
   └────────────────────────────────────────────────────────┘
```

This two-phase is *only* for contest creation. All other chat interactions go through MCP tool calls. The boundary is the *nature* of the output: a draft is data, a tool call is action. Drafts are reviewed in a form; tool calls are reviewed in the chat panel.

## 9. LLM-suggested defaults

The LLM may propose values for fields the host did not explicitly mention. The output schema tags each field with a `source`:

```ts
{ source: "host" | "llm_default" | "llm_extracted", ...value }
```

The form renders `llm_default` values with a visible badge. The form clears the badge the moment the host edits the value. The audit log records the source of every field at the time of `draft.saved`.

The defensible allow-list of fields the LLM may default (in v1):

- `name` — derived from theme
- `categories` — when the host says "three categories" and the venue is a tapas contest, default to Presentation / Originality / Taste
- `closeRule` — when unspecified, default to `all_sent`
- `revealStrategy` — when unspecified, default to `host_trigger`

The LLM may not default:

- `attribution` — high-stakes, requires explicit host intent
- `antiBias` — high-stakes, requires explicit host intent
- `range` — defaults to "auto" only when the host has not said otherwise
- `uniquePerCategory` — defaults to `false` only if the host mentioned a fixed range
- `participants` and their relations — never defaulted

## 10. The eval harness (extended)

Three eval sets, three AI surfaces, three audits.

### 10.1 Contest-creation eval (25 cases, unchanged)

- 8 simple
- 10 domain
- 4 partial + clarify
- 3 adversarial

Metrics: schema validity, field accuracy, missing-field recall, false-field rate.

### 10.2 Host-assistant eval (30+ cases, new)

The host-assistant eval measures *tool use*, not text generation. The cases are organized in five groups:

| Group | Count | What it tests |
|---|---|---|
| **Single-tool selection** | 10 | Host asks for X, LLM picks the right tool with the right args |
| **Multi-tool chaining** | 8 | Host asks for X then Y, LLM sequences correctly (e.g., "create then publish") |
| **Clarification vs. action** | 4 | Host is ambiguous; LLM asks for clarification rather than acting |
| **Destructive tool surfacing** | 4 | LLM picks a destructive tool, surfaces confirmation, does not act without it |
| **Adversarial** | 4 | Prompt injection through user-controlled fields (e.g., a participant name that contains a prompt) |

Metrics:

- **Tool selection accuracy** — did the LLM pick the right tool?
- **Tool argument accuracy** — are the args correct against ground truth?
- **Chaining correctness** — is the order right when multiple tools are called?
- **Confirmation surfacing** — when a destructive tool is needed, is confirmation requested (not auto-fired)?
- **Schema validity** — does the tool call parse against the tool's input schema?
- **False-tool rate** (adversarial) — does the LLM pick tools that don't exist or shouldn't apply?

### 10.3 Infrastructure-generation eval (new, smaller)

Symmetric to the others. The AI generates Dockerfiles, the CI pipeline, and the compose file from a spec. The output is graded on (a) builds, (b) tests pass, (c) deploys, (d) a human can read and amend it. Same four-metric shape as the contest-creation eval, applied to a different domain.

## 11. Tech stack (committed for v1)

- **Language & monorepo.** TypeScript everywhere, in an **npm-workspaces** monorepo: `domain` (pure domain: compiler, value objects, aggregates, domain events — zero I/O), `api`, `mcp`, `host-web`, `participant-web`, `shared` (DTOs + LLMClient interface), and `ui` (shared frontend components).
- **Frontends (two apps).** React + TypeScript, Vite, Tailwind, sharing the `ui` package. **Host/admin app**: desktop-and-mobile responsive; create/manage forms, tally, reveal control, chat panel. **Participant app**: mobile-first, PWA-installable; join, dish, score, reveal. Each calls the API with its own authorization scope.
- **Backend.** Node.js + TypeScript, Fastify. **MCP server.** A thin Node/TypeScript service. Calls the backend API over HTTP. Tool definitions are JSON files loaded at startup.
- **Persistence.** **SQLite for v1** (single machine, no ops), **Postgres-ready**: SQL with migrations, and no SQLite-only SQL so Postgres is a swap. JSON columns for the materialized constraint view, the MCP tool-call audit log payload, and the chat transcript.
- **Testing.** **Vitest everywhere** — backend, MCP, both frontends, the compiler, and the eval harnesses. One runner, one config style. **Acceptance tests are Gherkin `*.feature` files run through a Vitest-compatible runner** (e.g. `vitest-cucumber`), co-located with the feature they verify. **Playwright** for the E2E slice.
- **LLM.** **Provider-agnostic `LLMClient` interface** in `shared`; the concrete provider is deferred (chosen at Phase 2/3, when prompt tuning and eval baselines begin). Tool-calling support is a hard requirement of whichever provider is chosen. The MCP tool definitions are the integration contract.
- **Auth.** Host: email + password (or magic link). Participants: join code + display name + remember-me token, scoped to a single contest. MCP server is bound to a host session at the protocol level.
- **Realtime.** Polling for tallies and the chat panel. Refresh on reveal. SSE optional for the chat panel; websockets are not required in v1.
- **Deployment.** Cloud-shaped: Vercel for the frontend, a managed Postgres for the database, the LLM via a hosted provider. The whole thing must be runnable locally with `docker compose up` for the defense demo. The Dockerfiles and the compose file are *generated by AI as a thesis artifact*.

## 11A. Testing strategy (TDD / ATDD)

The project is built **outside-in, with double-loop TDD** (GOOS-style). The outer loop is an **acceptance test (ATDD)** per user story, written first as a **Gherkin `*.feature` spec**; the inner loop is **unit TDD** (red/green/refactor). This applies at every layer. The two streams think differently on purpose: **acceptance tests define *what* the system does** (external observables); **unit tests define *how* it does it** (internal structure). Both must pass; neither alone suffices.

```
  OUTER LOOP  (ATDD — one failing acceptance test per user story)
  ┌────────────────────────────────────────────────────────┐
  │  failing acceptance test for the feature                │
  │   INNER LOOP  (unit TDD — red/green/refactor)          │
  │   ┌──────────────────────────────────────────┐         │
  │   │  application services with INJECTED,       │         │
  │   │  MOCKED/FAKED repositories                 │         │
  │   └──────────────────────────────────────────┘         │
  │  acceptance test green → refactor                       │
  └────────────────────────────────────────────────────────┘
```

### 11A.1 Test doubles — the boundary

The two loops use doubles differently, on purpose:

- **Unit tests (inner loop).** Mock or fake injected repositories. Test the application service's logic and orchestration in isolation. Fakes (small in-memory implementations of the repository interface) are preferred over verify-heavy mocks to avoid coupling tests to *how* the service calls the repo.
- **Acceptance tests (outer loop, ATDD).** Use the **real repository against in-memory SQLite** with migrations applied. The persistence layer is load-bearing for correctness here — vote invariants are enforced by `UNIQUE(voteSessionId, dishId, categoryId)` and the `draft→sent` lock. A mocked repo would let a duplicate score through and pass; real SQLite catches it. That is exactly the class of bug acceptance tests exist to catch.

The boundary is not "DB vs. no DB" — it is **"deterministic and ours" vs. "external, non-deterministic, or slow":**

| Collaborator | In acceptance tests |
|---|---|
| Repositories / DB | **Real** — in-memory SQLite + migrations |
| Domain / compiler | **Real** — it is pure |
| The LLM (`LLMClient`) | **Fake** — canned drafts / tool-calls. The real LLM lives only in the eval harnesses |
| Clock / time (deadlines, scheduled close/reveal) | **Fake** — injectable clock, for determinism |
| Outbound reminders / notifications | **Fake** — assert invoked, do not send |

### 11A.2 Per-layer

| Layer | Style | Doubles |
|---|---|---|
| `domain` | pure unit, test-first, property-based + golden corpus | none (pure) |
| `api` services | unit TDD | mocked/faked repositories |
| `api` features | ATDD acceptance (Gherkin `*.feature`) | real SQLite; fake LLM/clock/notifications |
| `mcp` | contract tests: schema validity, destructive enforcement, "maps to API, no logic" | stub the API boundary |
| frontends | component tests, test-first | mock the API client |
| E2E | Playwright, one thin slice covering the demo flow across both apps | real API + fake LLM |

### 11A.3 Evals are not TDD

The three eval harnesses are **tests, but not TDD tests**. The LLM's output is not ours to make deterministic, so there is no red-green-refactor. Evals are **threshold-gated regression tests** ("schema validity ≥ 98%", "tool-selection accuracy ≥ 90%"), run on a separate track, with a documented trajectory over time.

### 11A.4 CI gates

- **Deterministic tests** (domain, api, mcp, frontends, E2E) — **hard gate**: any failure blocks the build.
- **Evals** — **threshold gate**: block only when a metric drops below its committed threshold; otherwise report and record the trajectory. A flaky single case does not block; a real regression does.

### 11A.5 ATDD discipline (Gherkin acceptance specs)

Acceptance tests are authored as **Gherkin `*.feature` files**, executed by a Vitest-compatible runner (e.g. `vitest-cucumber`) so we keep one test runner. The `.feature` files are **co-located with the feature/context they verify** (in `domain`, `api`, or the frontends). Discipline:

- **Spec-first, per feature.** Understand the feature → write the `*.feature` (Given/When/Then) → run it red (behavior doesn't exist yet) → implement with inner unit TDD until it goes green → review for leakage → next feature. `tasks.md` is the *roadmap of features*; ATDD is applied *within* each feature. We do **not** design the whole system upfront.
- **The spec-leakage rule (critical).** Acceptance specs use **domain language only** — never class names, DB tables, API endpoints, framework terms, internal state, or file paths. This is the **ubiquitous language** (`glossary.md`) exercised as an executable test.
  - ❌ `When a POST request is sent to /api/contests`
  - ✅ `When the host publishes the contest`
  This sharpens §11A.1: acceptance tests run against real SQLite but must never *name* it.
- **Specs are a contract.** A `*.feature` is not edited casually; if a step is ambiguous, the ambiguity is reported rather than guessed.
- **Isolation.** State is cleared before each scenario.
- **Format.** `Scenario:` for single behaviors; `Scenario Outline:` + `Examples:` for parameterized data (a natural fit for the rule-space variants — Strict / Permissive / Joint as example rows).

This applies the *methodology* of the ATDD skill at [github.com/swingerman/disciplined-agentic-engineering](https://github.com/swingerman/disciplined-agentic-engineering/blob/master/skills/atdd/SKILL.md); we deliberately do **not** adopt its `.build/` spec→IR→generated-test pipeline (that is its own tooling).

## 11B. Security

Security is the degree's curriculum anchor. This section makes the stance concrete and maps each measure to the OWASP Top 10 so the defense can demonstrate the taught material against real features. The guiding principles are **defense in depth**, **least privilege**, **fail securely**, and **verify authorization in the backend, always**.

### 11B.1 Authentication

- **Hosts / admins.** Email + password. Passwords hashed with **bcrypt (12+ rounds)** — never stored plaintext. Password policy validated with Zod (min 12 chars, mixed case, number, symbol). **Account lockout after 5 failed attempts** (15 min).
- **Tokens.** **JWT access token (15 min) + refresh token (7 days)**, stored in **httpOnly + Secure + SameSite cookies** — never localStorage (XSS defense). Refresh-token rotation on use; a logout blacklist invalidates active tokens. The signing secret is 64+ chars, in an env var, never in code.
- **Cross-origin note.** The two frontends and the API are separate origins, so cookies are `SameSite=None; Secure` with a **CORS allowlist** (explicit origins, `credentials: true`) — never `origin: '*'`.
- **Participants (voters).** Join code + display name + a remember-me token, **scoped to a single contest**. No account.
- **External MCP clients.** A **host-issued personal access token** (scoped, revocable, generated in the host app), sent as `Authorization: Bearer`. The in-app chat panel instead reuses the host's cookie session. Both resolve to the same host identity and the same authorization checks.

### 11B.2 Authorization

- **Three roles:** `admin` (global — moderation, see all contests), `host` (owns their contests), `voter` (scoped to one contest). Role checks via a `requireRole()` middleware.
- **Ownership is the primary check** (OWASP A01). Role alone is not enough: a host operation verifies the host **owns** the target contest; a voter operation verifies the voter belongs to that contest. `401` = not authenticated; `403` = authenticated but not permitted.
- **Enforced in the backend on every request** — never trust the client. The MCP server makes no authorization decisions of its own; the API does.

### 11B.3 Input & injection defenses

- **Parameterized queries everywhere** (OWASP A03); no string-concatenated SQL. A least-privilege DB user.
- **Two-phase validation** (already in the design): the LLM output is structurally bounded by `additionalProperties:false` schemas, then re-validated by the API's authoritative Zod validators. Belt and braces.
- **XSS:** React auto-escapes; **DOMPurify only where `dangerouslySetInnerHTML` is unavoidable**. User-controlled fields (participant names, dish descriptions) are treated as data, including inside LLM prompts.
- **Env validation at startup** with Zod (fail-fast): the app refuses to boot on missing/invalid config.

### 11B.4 Transport, headers, configuration

- **HTTPS everywhere**, with forced HTTP→HTTPS redirect and **HSTS**.
- **Helmet** on the API: CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS.
- **Restrictive CORS** allowlist (the two known frontend origins only).
- **Generic errors in production** (OWASP A04/A05): "Invalid credentials", never "user not found"; no stack traces to the client (logged server-side only).

### 11B.5 Rate limiting

Stricter limits on sensitive endpoints: **login** (brute-force / credential stuffing), **join-by-code** (guessing), **password reset**, and **destructive MCP tools**. Join codes are **high-entropy (non-sequential)** and **expire when the contest closes**.

### 11B.6 Secrets

No hardcoded secrets. `.env` git-ignored; `.env.example` committed. Rotation supported (accept old+new during rollover). Secrets never logged, never in error messages, never in URLs, never in LLM prompts. Only `VITE_`-prefixed vars are exposed to the browser.

### 11B.7 Logging & monitoring (OWASP A09)

The audit log (§5, event-projection) already records domain actions. Security-specifically: **log auth events** (login success/fail with reason, permission changes, PAT issuance/use, destructive-tool calls) with actor + IP + timestamp; **never log** passwords, full tokens, or PII. Alert on anomalies (e.g. >N failed logins).

### 11B.8 Supply chain & integrity (OWASP 2025)

`npm audit` in CI; Dependabot for updates; lockfile committed. This addresses the 2025 list's new **Software Supply Chain Failures** category, beyond the 2021 material.

### 11B.9 OWASP Top 10 → Tapas mapping (defense artifact)

| OWASP | Defense in Tapas |
|---|---|
| A01 Broken Access Control | Backend authz on every request; **ownership** checks + `requireRole()`; MCP has no authz of its own |
| A02 Cryptographic Failures | bcrypt 12+; HTTPS + HSTS; secrets in env |
| A03 Injection | Parameterized SQL; `additionalProperties:false` + Zod two-phase; least-priv DB user |
| A04 Insecure Design | Rate limiting; generic errors; threat model; destructive-tool confirmation ×3 layers |
| A05 Security Misconfiguration | Helmet; CORS allowlist; no stack traces in prod; env validated at startup |
| A07 Authentication Failures | Strong password policy; short-lived access token + refresh; account lockout |
| A09 Logging/Monitoring Failures | Audit log as event projection; auth-event logging; alerts; no secrets in logs |
| 2025: Supply Chain | `npm audit` in CI; Dependabot; committed lockfile |

## 11C. Accessibility & usability

Also a curriculum module. The participant app is used **live at a venue** — one-handed, poor lighting, older phones, time pressure — which is exactly WCAG's "temporary disability / bright sunlight" case. Accessibility here is core UX, not a compliance checkbox. **Target: WCAG 2.1 Level AA.**

### 11C.1 Foundations (both apps)

- **Semantic HTML** — `<button>`, `<label>`, `<nav>`, headings; never a clickable `<div>`. React auto-escapes (also the XSS defense in §11B).
- **Keyboard operable** — everything reachable with Tab/Shift+Tab/Enter/Escape; **`:focus-visible`** styles (never `outline:none`); focus-trap in modals/confirmation cards; a skip-to-main link.
- **Screen readers** — ARIA labels on icon-only buttons (e.g. remove, show-password); `aria-live` for dynamic content (tally updates, "Saving…", the reveal); `aria-invalid` + `role="alert"` on field errors.
- **Contrast & color** — 4.5:1 normal text, 3:1 large; **color is never the sole signal** (winners, score categories) — pair with text/icon for colorblind users.
- **No seizure triggers** — the reveal beat animates without flashing.
- **Zoom** — legible at 200%.

### 11C.2 Forms (score screen, join, contest creation)

- Labels always visible and associated; required/optional marked.
- **Semantic input types** for the right mobile keyboard; **`inputmode`** where finer control is needed.
- **Validate on blur + submit** (never onChange-aggressive, never submit-only); **inline, actionable error messages** derived from the rules ("Score must be 1–8", from the materialized range).
- **44×44px touch targets**; **16px input font** (prevents iOS zoom); single-column layout; a persistent/visible primary action.
- Loading + success feedback; **prevent double-submit** on `send_vote` (also a correctness concern — the vote locks).

### 11C.3 Adaptive score input (the core participant UI)

The score screen adapts to the compiled contest config:

- **Repeats allowed** (fixed range, `uniquePerCategory=false`) → per-dish **stepper / rating** controls.
- **Strict permutation** (`uniquePerCategory=true`, range `1..N`) → a **ranking / assignment UI** where each dish takes a distinct value per category, so an invalid (duplicate) score is impossible to enter by construction (Nielsen H5, error prevention).

Both modes read the allowed range and rules from the materialized view — the UI never re-interprets the rule language.

### 11C.4 Nielsen heuristics → Tapas

- **H1 visibility** — tally polling, "Saving…", the reveal beat.
- **H3 control/freedom** — a **sent vote is final by design**, so the pre-send **confirmation is the safety net** (there is no undo to offer).
- **H4 consistency** — enforced by the shared `ui` package (one button, one pattern across both apps).
- **H5 error prevention** — adaptive score input; "Send" disabled until complete.
- **H9 error recovery** — specific, actionable messages, never codes.

### 11C.5 Testing

- **Automated:** `axe-core` runs inside the Playwright E2E and **hard-gates** the build on violations; Lighthouse accessibility score tracked over time.
- **Manual (before the defense):** full keyboard-only pass, screen-reader pass (VoiceOver / NVDA), and a 200%-zoom pass, against a documented checklist.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| The compiler is wrong on edge cases | 50+ unit tests, property-based testing, golden test corpus |
| The LLM picks the wrong tool | 30+ tool-selection eval cases; chain-level eval; confirmation flow for destructive actions |
| The LLM fires destructive actions without confirmation | Destructive flag is enforced at three layers: chat UI, MCP server, API |
| Prompt injection through user-controlled fields | `additionalProperties: false` on every tool schema; the API re-validates; adversarial eval set measures false-tool rate |
| Auth friction kills adoption at the venue | Join code is one tap. No accounts. v1 is built around the venue use case. |
| The "moment" of reveal is underwhelming | Reveal is on host trigger (or scheduled). The page is a deliberate beat, not a status update. |
| The MCP server becomes a parallel code path | It is a thin adapter. It does not access the DB. It only calls the API. Tests assert this. |
| Over-scoping | "Out of scope (v1)" list is in the proposal. The tool catalog is finite and listed. |
