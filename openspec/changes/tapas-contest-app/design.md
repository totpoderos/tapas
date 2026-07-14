# Design: Tapas Contest App

> The system is shaped by two architectural decisions. **First**, the rule language is consulted at *publish* time, never at *runtime*. **Second**, the backend API is the source of truth; the MCP server is a thin protocol adapter; the Web UI and the chat assistant are two consumers of the same API. This document describes what flows through those boundaries and why.

## 1. The system, end to end

```
   ┌─────────────────┐         ┌─────────────────┐
   │     Web UI      │         │  Chat Assistant │
   │                 │         │   (in Web UI)   │
   │  - forms        │         │                 │
   │  - score        │         │  LLM picks      │
   │    screens      │         │  tools from     │
   │  - reveal       │         │  the catalog    │
   │  - tally        │         │                 │
   │                 │         │  destructive    │
   │  calls API      │         │  tools require  │
   │  directly       │         │  confirmation   │
   └────────┬────────┘         └────────┬────────┘
            │ HTTPS                     │ MCP
            ▼                           ▼
   ┌─────────────────────────────────────────────────┐
   │              BACKEND API                        │
   │                                                 │
   │  - contests, drafts, dishes, scores             │
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

## 5. The audit log (extended)

```
AuditEntry
  id, contestId
  actorId            PersonId (host, voter, or "system")
  action             string
  before?, after?    JSON
  sourcePath         "form" | "mcp" | "system"
  toolName?          string       // present when sourcePath="mcp"
  toolArgs?          JSON         // present when sourcePath="mcp"
  confirmation?      "host" | "auto"   // destructive tools only
  at                 ISO timestamp
```

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

The chat assistant is the Web UI's *chat panel*. It is an LLM-mediated interface to the same MCP tools any other client could call. Its UX is:

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

## 11. Tech stack (concrete proposals, not yet committed)

- **Frontend.** React + TypeScript, Vite, Tailwind. PWA-installable. Mobile-first responsive. Chat panel as a first-class UI surface.
- **Backend.** Node.js + TypeScript, Fastify. SQLite for v1 (single machine, no ops), Postgres-ready.
- **MCP server.** A thin Node/TypeScript service. Calls the backend API over HTTP. Tool definitions are JSON files loaded at startup.
- **Persistence.** SQL with migrations. JSON columns for the materialized constraint view, the MCP tool-call audit log payload, and the chat transcript.
- **LLM.** Provider-agnostic interface. Default: a hosted model with tool-calling support. The MCP tool definitions are the integration contract.
- **Auth.** Host: email + password (or magic link). Participants: join code + display name + remember-me token, scoped to a single contest. MCP server is bound to a host session at the protocol level.
- **Realtime.** Polling for tallies and the chat panel. Refresh on reveal. SSE optional for the chat panel; websockets are not required in v1.
- **Deployment.** Cloud-shaped: Vercel for the frontend, a managed Postgres for the database, the LLM via a hosted provider. The whole thing must be runnable locally with `docker compose up` for the defense demo. The Dockerfiles and the compose file are *generated by AI as a thesis artifact*.

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
