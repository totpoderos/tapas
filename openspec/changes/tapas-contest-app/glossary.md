# Glossary — the ubiquitous language

This is the **one language** of the project. The same terms name the domain code, the API, the MCP tools, the Gherkin acceptance specs, and the eval cases. When a concept is renamed, it is renamed *everywhere*.

Two rules govern use of this glossary:

- **Ubiquitous language (DDD).** Code, DTOs, endpoints, and tool names use these terms. If the code and this glossary disagree, one of them is a bug.
- **Spec-leakage rule (ATDD).** Gherkin acceptance specs use the **Concept** column only — the domain words. They never name the **Code / technical form** (class names, tables, endpoints, file paths). "When the host publishes the contest", never "When a POST is sent to `/api/contests`".

`Canonical` gives the exact identifier to use in code (TypeScript). Enum values are in `code font`.

---

## Roles & people

| Concept | Canonical | Definition |
|---|---|---|
| **Person** | `Person` | A human in the system (aggregate). Has `displayName`, optional `partnerId`, optional `noScoreWith[]`. A person plays roles (host, cook, judge); the person is not the role. |
| **Host** | `host` (role) | Creates, configures, and owns a contest; controls close and reveal; sees tallies. Authenticates with email + password. Owns *their* contests (ownership is the authorization check, not just the role). |
| **Admin** | `admin` (role) | Global role: moderation, visibility across all contests. Distinct from host; not scoped to ownership. |
| **Voter** | `voter` (role) | A participant authenticated *for a single contest* (join code + display name + remember-me token). The auth-scoped term for anyone who scores. |
| **Cook** | *(cook)* | A voter who submits a dish. Every cook is also a judge. "Cook" describes what the person does, not a separate auth role. |
| **Judge** | *(judge)* | A voter who scores dishes. At organized events, attendees who did not cook are still judges. |
| **Participant** | *(participant)* | Umbrella for the people taking part in a contest (cooks and judges). Enroll themselves via the join code. |
| **Couple / partner** | `partnerId` | Two persons linked as partners; the basis of the `couples` anti-bias rule. |

> Note on roles: `admin`, `host`, `voter` are the three **authorization roles** (see security §11B). *Cook* and *judge* are **domain descriptions** of what a voter does within a contest, not extra auth roles.

## Contest lifecycle

| Concept | Canonical | Definition |
|---|---|---|
| **Draft** | `Draft` | The mutable, pre-publish contest configuration (aggregate). Retired at publish. |
| **Contest** | `Contest` | A published contest (aggregate). Holds the immutable `MaterializedContest`. Its config is a value object, not editable after publish. |
| **Publish** | `publish` | The act of turning a draft into a live contest: runs the compiler, persists the materialized view, generates the join code. |
| **Compile / compiler** | `compile` | The pure function `compile(draft) → MaterializedContest \| CompileError`. No I/O, no LLM. The load-bearing domain artifact. |
| **MaterializedContest** | `MaterializedContest` | The compiled constraint view: `dishes[]`, `allowedVoters`, `validScoreRange`. The runtime checks against this; it never re-interprets the rule language. |
| **Status** | `status` | `draft` \| `scheduled` \| `live` \| `scoring` \| `closed`. |
| **Join code** | `joinCode` | The code a participant enters to enroll in a contest. High-entropy, non-sequential, expires on close. |
| **Close** | `close` | The contest transitions to `closed`. Triggered by `all_sent`, `host_trigger`, or a scheduled time (`CloseRule`). |
| **Reveal** | `reveal` | Announcing the winners (global and per category). Host-triggered or scheduled (`RevealStrategy`). A deliberate UI beat. |

## The rule space (configuration)

The rule space is a set of value objects the host chooses; the compiler consumes them.

| Concept | Canonical | Definition |
|---|---|---|
| **Attribution** | `attribution` | Who a dish is credited to: `per_person` \| `per_couple`. |
| **Anti-bias** | `antiBias` | Who may not score whom: `none` \| `couples` \| `arbitrary_pairs`. |
| **ScoringConfig** | `ScoringConfig` | The scoring rules: `categories`, `range`, `uniquePerCategory`. |
| **Range** | `range` | The allowed score range: fixed `{ min, max }`, or `auto` (resolves to `1..N`). |
| **Category** | `Category` | A scored dimension (e.g. Presentation, Originality, Taste). No weights in v1. |
| **Unique per category** | `uniquePerCategory` | `true` = strict permutation (each score used once per category); `false` = repeats allowed. |
| **Variant** | *(variant)* | A named point in the rule space, used in specs and evals. **Strict** (per_person, couples, 1..N, unique), **Permissive** (per_person, couples, 1..10, repeats), **Joint** (per_couple, couples, 1..10, repeats). |

## Scoring

| Concept | Canonical | Definition |
|---|---|---|
| **Dish** | `Dish` | A submitted tapa (aggregate): `displayName`, optional description/photo, `submitterIds`. |
| **VoteSession** | `VoteSession` | A voter's scoring session for a contest (aggregate). Status `draft` \| `sent`. Contains `Score` entities. The consistency boundary for vote invariants. |
| **Score** | `Score` | A value for a `(dish, category)` pair within a vote session. |
| **Save (a score)** | `saveScore` | Store/edit a score while the session is `draft`. Freely editable until sent. |
| **Send (a vote)** | `sendVote` | Lock the session (`draft → sent`). **A sent vote is final** — there is no edit-after-send in v1; the pre-send confirmation is the safety net. |
| **Tally** | `tally` | The standings / counts of a contest (draft vs. sent sessions, per-dish and per-category totals). |

## Reveal & results

| Concept | Canonical | Definition |
|---|---|---|
| **Results** | `results` | The final outcome after reveal: global winner and per-category winners. |
| **Tie** | *(tie)* | Equal totals for a winning position. |
| **Resolve tie** | `resolveTie` | The host picks the winner on a tie (a destructive, host-only action). |

## Technical & cross-cutting

| Concept | Canonical | Definition |
|---|---|---|
| **Backend API** | *(api)* | The single source of truth. Enforces invariants, authorization, validation; owns the audit log. |
| **MCP server** | *(mcp)* | A thin protocol adapter that exposes the API as MCP tools. No business logic, no direct DB access. |
| **MCP tool** | *(tool)* | A named operation in the MCP catalog (e.g. `add_participant`, `send_reminder`, `trigger_reveal`). |
| **Destructive tool** | `destructive` | A tool that mutates state irreversibly/noisily; requires explicit host confirmation (enforced at chat UI, MCP server, and API). |
| **Chat assistant / host assistant** | *(assistant)* | The LLM-mediated chat panel in the **host app** that translates host intent into MCP tool calls. Not present in the participant app. |
| **Domain event** | `DomainEvent` | An event emitted by an aggregate on every state change (e.g. `draft.saved`, `vote.sent`, `contest.revealed`). |
| **Audit log / audit entry** | `AuditEntry` | A **projection of domain events**, enriched with request-path metadata. Answers "who did what, when, from which path". |
| **sourcePath** | `sourcePath` | How an action was triggered: `form` \| `mcp` \| `system`. On `mcp`, `toolName`/`toolArgs` are recorded. |
| **Confirmation** | `confirmation` | On destructive actions: `host` (explicitly confirmed) \| `auto`. |
| **PAT (personal access token)** | *(pat)* | A host-issued, scoped, revocable bearer token used by external MCP clients to authenticate as the host. |
| **LLMClient** | `LLMClient` | The provider-agnostic interface (in `shared`) behind which the concrete LLM provider sits. |

---

## Terms we deliberately do **not** use

To keep the language tight, avoid these near-synonyms in code, specs, and UI:

- ❌ "cesta" / "basket" / "cart" → this is not commerce; there is no cart.
- ❌ "user" as a domain term → use the specific role (`host`, `admin`, `voter`) or `Person`.
- ❌ "rating" as the noun for a stored value → the stored value is a **Score**. ("Rating" may describe the *input control* in repeat-allowed mode only.)
- ❌ "submit" for sending a vote → use **send** (`sendVote`); "submit" is for **dishes** (`submitDish`).
- ❌ "event" for the contest → a contest is a **Contest**; "event" is reserved for **domain events**.
