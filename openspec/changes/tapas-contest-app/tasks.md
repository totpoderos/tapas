# Tasks

This is the implementation plan for the Tapas Contest App. The ordering is deliberate: each task produces a runnable artifact that the next task depends on. There are no parallel tracks; the project is too small for that and the dependencies are too tight.

The project has **three AI surfaces**, each with its own eval set:

1. **Contest-creation LLM** — extracts `ContestDraft` from natural language. 25 cases.
2. **Host-assistant LLM** — picks MCP tools in response to host messages. 30+ cases.
3. **Infrastructure-generation AI** — produces Dockerfiles, CI pipeline, compose file. ~10 cases.

All three are governed by the same discipline: schema-validate the output, review it, version it, audit every action.

## Phase 0 — Skeleton (1–2 days)

The minimum scaffolding to start the project. Services in one monorepo: `api`, `mcp`, and two frontends `host-web` and `participant-web`. A pure `domain` package, a `shared` package (DTOs + LLMClient), and a shared `ui` package for the two frontends.

- [x] **0.1** Initialize repo, TypeScript everywhere, monorepo layout (workspaces for `domain`, `api`, `mcp`, `host-web`, `participant-web`, `shared`, `ui`). Add a lint/build rule that forbids I/O imports in `domain` (no DB, LLM, or network deps) — *ESLint `no-restricted-imports` rule, verified to block `node:fs`*
- [x] **0.2** Create a provider-agnostic `LLMClient` interface in `shared` with a stub implementation (concrete provider deferred to Phase 2/3; tool-calling is a hard requirement)
- [x] **0.3** Set up SQLite persistence (Postgres-ready: migrations, no SQLite-only SQL); create the migration runner in `api` and a single empty migration — *uses built-in `node:sqlite` (requires Node ≥24)*
- [x] **0.4** Set up Vitest as the single test runner across all workspaces (backend, MCP, both frontends); add a **Gherkin runner** (`vitest-cucumber`) for `*.feature` acceptance specs (proven with `api/tests/acceptance/health.feature`). Test layout: `src/` is source-only, each package has a sibling `tests/{unit,integration,acceptance}/` mirroring `src/`, and whole-system `tests/e2e/` at the repo root. Document the **spec-leakage rule** (acceptance specs use glossary/domain language only) as a contributor convention. *Playwright + `axe-core` E2E deferred to Phase 5, when there is a flow to drive; the full acceptance harness (real in-memory SQLite, fake `LLMClient`, injectable clock, fake notifier, per-scenario reset) is built out in Phase 2 alongside the DraftService.*
- [x] **0.5** Create the `shared` types package so the model types are reused end-to-end (API, MCP, Web)
- [x] **0.6** Define the `DomainEvent` base type in `domain` and the `AuditEntry` projection type in `shared`; add a thin audit-projection interface in `api` (events in → enriched audit entries out)
- [x] **0.8** Adopt `glossary.md` (drafted in exploration — the ubiquitous language) into the repo; wire it as the naming reference for code, API, MCP tools, Gherkin specs, and eval cases. Keep it in sync as terms evolve
- [ ] ~~**0.7** Set up the local infra: a `docker-compose.yml` stub~~ — **dropped.** Superseded by the CI/CD split (0.10 / Phase 6): no hand-built Docker before Phase 6, where the Dockerfiles and compose are AI-generated.
- [x] **0.9** Set up config/secrets handling: Zod env-validation at startup (fail-fast) in `api`/`mcp`; `.env.example` committed, `.env` git-ignored; only `VITE_`-prefixed vars exposed to the frontends
- [x] **0.10** Add a minimal, **hand-written CI workflow** (GitHub Actions): install → typecheck → lint → `npm test` on every push/PR, hard-gating from commit one. This is deliberately *not* the AI-generated infra — Dockerfiles, compose, image build, and CD are the AI-generated Phase 6 artifact (6.1–6.4) layered on top of this skeleton

**Done when:** `npm test` runs and passes. `npm run dev` starts the API, the MCP server, the host app, and the participant app. Both frontends can hit the API. The MCP server can hit the API. CI runs the hard-gate (typecheck + lint + tests) on every push/PR.

## Phase 1 — The compiler (1 week)

The compiler is the load-bearing artifact of the project. Pure function, no I/O, no LLM. Lives in the `domain` package. 50+ unit tests before anything else.

- [x] **1.1** Define the compiler-facing domain model in `domain`: value objects (`ScoringConfig`, `ScoreRange`, `Attribution`, `AntiBias`, `Category`), `Person`, `ContestDraft` (input), `MaterializedDish` + `MaterializedContest` (output). *Runtime aggregates with behaviour (`Contest`, `VoteSession`+`Score`, `Draft`) land in Phase 2 with the services.*
- [x] **1.2** Implement the compiler signature in `domain`: `compile(draft) -> CompileResult` (ok+contest | typed error)
- [x] **1.3** Implement attribution: `per_person` and `per_couple` modes
- [x] **1.4** Implement anti-bias: `none`, `couples`, `arbitrary_pairs` modes (plus the baseline "never score your own dish")
- [x] **1.5** Implement range resolution: fixed `{min, max}` and `auto` (1..dishes-a-judge-can-score)
- [x] **1.6** Implement validation: reciprocal partners, no orphan partners, valid ranges, no judge left unable to score, no duplicate ids, non-empty contest
- [x] **1.7** Acceptance spec (Gherkin, confirmed with the user) covering Strict / Joint / Permissive + 23 unit tests
- [x] **1.8** Property-based tests (`fast-check`): deterministic output, no self-scoring, valid ranges, couples symmetry (300 runs each)
- [x] **1.9** Golden corpus: hand-curated drafts with fully-specified expected outputs, frozen as fixtures

**Done when:** `npm test` runs 50+ compiler tests in under a second. The compiler has no external dependencies (no DB, no LLM, no network). ✅ *domain suite: 81 tests in ~0.65s; purity enforced by the ESLint no-I/O rule.*

## Phase 2 — Backend API and DraftService (1.5 weeks)

The API is the source of truth. Every other component (the two frontends, MCP server, chat) calls it. Persistence becomes real here.

- [ ] **2.1** Create the schema migrations: `persons`, `contests`, `contest_drafts`, `dishes`, `vote_sessions`, `scores`, `audit_log` — *`contest_drafts` + `audit_log` (0002, Slice A), `contests` (0003, Slice B), `host_accounts` (0004, Slice C1), `host_sessions` (0005, Slice C2), `persons` (0006, reworked to the roster in 0009), `dishes` (0010, Slice D1), `vote_sessions`/`scores` (0011, Slice D2a) done.*
- [x] **2.2** Implement the DraftService: create, read, update (rename), delete on drafts — *Slice A: SQLite-backed, ownership-scoped (A01), emits `draft.*` events. Slice C-http: exposed over HTTP — `POST /drafts` (create), `GET /drafts` (list own), `GET /drafts/:id` (read), `PATCH /drafts/:id` (rename), `DELETE /drafts/:id` (discard), all behind `requireHostSession` with route-level ownership (401/403/404).*
- [ ] **2.3** Implement the LLMClient: function-calling adapter that takes a host message and returns a parsed `ContestDraft` shape (or partial + clarifications)
- [ ] **2.4** Implement the two-phase contest-creation flow: extract → clarify → finalize
- [x] **2.5** Implement draft validation: the backend's authoritative validator, separate from the LLM schema — *Slice A: `validate()` in DraftService (name required to save); full publishability validation at publish (Slice B).*
- [ ] **2.6** Define the domain-event catalog in `domain` (`draft.saved`, `contest.published`, `voter.joined`, `dish.submitted`, `score.drafted`, `vote.sent`, `contest.closed`, `contest.revealed`, …) and have aggregates emit them. Wire the audit projection in `api`: each emitted event is projected to an `AuditEntry` enriched with request-path metadata (`sourcePath`, and `toolName`/`toolArgs`/`confirmation` when applicable). No scattered `record()` calls — *`draft.saved`/`draft.updated`/`draft.discarded` (Slice A) + `contest.published` (Slice B) emitted; audit projection wired (`AuditRecorder` → `audit_log`). Remaining events land with their slices.*
- [ ] **2.7** Wire authentication: host/admin signup + login (bcrypt 12+, Zod password policy, account lockout after 5 fails); JWT access token (15m) + refresh token (7d) in httpOnly + Secure + SameSite cookies; refresh rotation + logout blacklist; voter join (code + display name + remember-me token); host-issued personal access tokens (bearer) for external MCP clients — *Slice C1 done: `RegisterHost`/`AuthenticateHost` use cases (bcryptjs 12+, password policy, lockout after 5 → distinct `ACCOUNT_LOCKED`, generic `INVALID_CREDENTIALS` = no enumeration); hand-rolled HMAC JWT access(15m)+refresh(7d) issuance. Slice C2 done: `HmacJwtTokenIssuer` now issues a shared `jti` per session, tracked in a `SessionStore` (`host_sessions` table) — real revocation, not just TTL expiry; `RefreshSession` (rotates: old `jti` revoked, fresh session activated) and `SignOutHost` (idempotent revoke) use cases; Fastify routes `/auth/{register,login,refresh,logout}` deliver the session in httpOnly+SameSite=strict cookies (`secure` in production); `requireHostSession` preHandler protects `/drafts`. Slice C3a done: voter join (see 2.9). Slice C3b done: host personal access tokens — `IssuePat`/`RevokePat` use cases (`host_pats` table, 0007), SHA-256 hash-then-lookup (a PAT is high-entropy, unlike a password, so no slow hash is needed), `POST /auth/pats` + `DELETE /auth/pats/:id`; `requireHostSession` now accepts either the `access_token` cookie or an `Authorization: Bearer` PAT, both resolving to the same host identity and authorization checks. Remaining: admin signup.*
- [ ] **2.7b** Implement authorization: three roles (`admin`/`host`/`voter`) via a `requireRole()` middleware, plus **ownership** checks on every host/voter operation (A01); correct 401 vs 403 — *Slice C2: host ownership check done for `/drafts/:id` (404 no-such-draft vs 403 not-your-draft vs 401 not-signed-in). Slice C3a: `requireVoterSession` scopes a voter's token to its own `contestId` (401 no/invalid token, 403 token for a different contest); a voter token carries no weight on host routes at all (separate cookie namespace). Slice C3b: PAT ownership enforced on revoke (404 no-such-token vs 403 someone else's vs 401 not-signed-in). Full three-role `requireRole()` middleware (admin role) awaits C3c.*
- [x] **2.7c** Add security middleware to the API: Helmet (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy), restrictive CORS allowlist (the two frontend origins), forced HTTPS redirect, rate limiting (login, join-by-code, password reset, destructive tools), generic production errors (no stack traces), security-event logging (login success/fail, permission changes, PAT use — never secrets/PII) — *Slice C3c-i done: `@fastify/helmet` (X-Frame-Options: DENY explicitly, HSTS/CSP/nosniff/Referrer-Policy via defaults) + `@fastify/cors` allowlisting `HOST_WEB_ORIGIN`/`PARTICIPANT_WEB_ORIGIN` with `credentials: true`; forced HTTP→HTTPS redirect in production (`trustProxy: true` so `request.protocol` honours `X-Forwarded-Proto`); generic `INTERNAL_ERROR` response (no stack trace) on unhandled errors in production. Also fixed a design/implementation mismatch found while wiring CORS: session cookies (host + voter) were `SameSite=strict`, which silently breaks once the frontends are genuinely cross-origin from the API — switched to `SameSite=None; Secure` per design.md §11B.1. Slice C3c-ii done: `@fastify/rate-limit`, 5/minute per IP (matching the account-lockout threshold) on `POST /auth/login` and `POST /contests/:joinCode/join` via per-route `config.rateLimit`, a generous global default elsewhere. Slice C3c-iii done: `security_events` table (0008) + `SecurityEventLog` recording sign-in success/refusal (with an internal `logReason` — `unknown_account`/`bad_password`/`account_locked` — that stays truthful to the log while the client keeps the generic `INVALID_CREDENTIALS`, no enumeration), PAT issued/used, each with source IP; never stores a password or full token. Recorded at the HTTP boundary (where IP/outcome exist), deliberately distinct from the domain-event audit log. Also addressed a review finding: the production error handler now logs the real error server-side before returning the generic body (Fastify logger enabled in production). **Deferred (no feature to hook yet):** permission-change logging (no role management), destructive-tool logging + password-reset/destructive-tool rate limiting (no MCP tools / reset flow) — each lands with its feature.*
- [x] **2.8** Implement contest publish: invoke the compiler, persist the materialized constraint view as a JSON blob, generate the join code — *Slice B: `PublishContest` use case + domain `Contest.publish`; retires the draft, carries the id through, emits `contest.published`. Slice C-http: exposed as `POST /drafts/:id/publish` (host-owned, 403 cross-host, 422 unpublishable) returning `{id, name, joinCode}` — the create→publish→join lifecycle is now drivable end-to-end over HTTP.*
- [x] **2.9** Implement participant join: join code → display name → remember-me token — *Slice C3a introduced free-name join (`JoinContest`, `persons` 0006). **Reworked in the roster-claim pre-slice** (prerequisite for scoring): a joined voter had no link to the compiled view's participant ids, so scoring couldn't identify them. Now publish seeds a roster (`persons` reworked in 0009: `(contest_id, participant_id, display_name, claimed_at)`); a person claims a place by participant id via `ClaimPlace` (`GET /contests/:joinCode/places`, `POST /contests/:joinCode/claim`), and the voter token's `sub` is the participant id the materialized view uses. `GET /contests/:contestId/me` recognises a returning participant by cookie. Claim is atomic (refuses `PLACE_TAKEN` / `NO_SUCH_PLACE`). Late-comers / host add-remove deferred.*
- [ ] **2.10** Implement dish submission, vote session, score writes (with runtime checks against the materialized view) — *Slice D1 done (dish submission): `dishes` table (0010) + `SubmitDish` use case + voter-scoped `POST/GET /contests/:contestId/dishes`. A cook's dish is derived from the compiled view's `submitterIds` for their participant id — they can only submit their own dish (upsert, so revising doesn't duplicate), and partners who share a slot share the dish. Photo upload deferred; host-side `list_dishes` deferred. Slice D2a done (draft scoring): `vote_sessions`/`scores` tables (0011); a pure domain `checkScore(materialized, voterId, input)` validates a score against `allowedVoters`/`categories`/`scoreRangeByVoter` (DISH_NOT_OPEN/UNKNOWN_CATEGORY/OUT_OF_RANGE) — the compiled view, never re-interpreted; `SaveScore` upserts into an implicitly-created draft vote session (no separate "start" step), reusing the existing row's id on revision so it doesn't drift from what `ON CONFLICT` actually persists; `GetMyScores` reads a voter's own draft. Voter-scoped `POST/GET /contests/:contestId/scores`. Remaining: `send_vote` (draft→sent lock, completeness + `uniquePerCategory` permutation check at send) — Slice D2b.*
- [ ] **2.11** Implement close logic (all_sent / host_trigger / scheduled) and reveal logic
- [ ] **2.12** Implement read endpoints: `get_contest`, `get_tally`, `get_results` — *Slice C-http: `get_contest` exposed as `GET /contests/:id` (host-owned; distinct from the voter-scoped `GET /contests/:contestId/me`). `get_tally`/`get_results` await scoring/reveal (Slices D/E).*
- [ ] **2.13** Write Gherkin acceptance features for the API (domain language only, real SQLite): form path, LLM path, partial + clarify, schema-rejection on adversarial inputs, and the full contest flow — using a `Scenario Outline` + `Examples` over the rule-space variants (Strict / Permissive / Joint)

**Done when:** The API can be driven end-to-end via HTTP for the full Strict variant. The audit log records every change. Auth works. The eval harness can be pointed at the API for the contest-creation eval.

## Phase 3 — Eval harness and prompt iteration (1 week)

Two AI surfaces get evaluated here: the contest-creation LLM (25 cases) and a *baseline* of the host-assistant LLM. The full host-assistant eval lands in Phase 4, after the MCP tools exist.

- [ ] **3.1** Define the eval case schema: `input` (host message), `ground_truth` (expected draft or tool calls), `category`
- [ ] **3.2** Author 25 contest-creation cases: 8 simple, 10 domain, 4 partial + clarify, 3 adversarial
- [ ] **3.3** Implement the eval runner: takes cases + LLMClient, returns per-case results and aggregate metrics
- [ ] **3.4** Implement the four metrics: schema validity, field accuracy, missing-field recall, false-field rate
- [ ] **3.5** Run the eval against the baseline prompt; record results
- [ ] **3.6** Iterate on the prompt; record results; build a trajectory in `docs/eval-trajectory.md`
- [ ] **3.7** Commit a frozen eval set to the repo so the trajectory is reproducible

**Done when:** `npm run eval:creation` produces a JSON report with the four metrics for 25 cases. The trajectory is documented.

## Phase 4 — MCP server and host-assistant eval (1.5 weeks)

The MCP server is a thin adapter over the API. The host-assistant LLM is the second AI surface.

- [ ] **4.1** Define the MCP tool catalog: name, description, input schema, destructive flag, authorization scope (from `design.md §6.1`)
- [ ] **4.2** Implement the MCP server skeleton: a Node/TypeScript service that loads tool definitions and dispatches to API calls
- [ ] **4.3** Implement the tool dispatcher: for each tool, a function that maps `(name, args, hostSession)` to an HTTP request against the API
- [ ] **4.4** Implement the destructive-tool enforcement: the MCP server requires a `confirmationToken` from the client for destructive calls; rejects without it
- [ ] **4.5** Implement the host-assistant LLMClient: takes a chat history, returns one or more tool calls
- [ ] **4.6** Author 30+ host-assistant cases: 10 single-tool, 8 multi-tool, 4 clarification, 4 destructive-surfacing, 4 adversarial
- [ ] **4.7** Implement the host-assistant eval runner with the five metrics
- [ ] **4.8** Run the eval against the baseline prompt; iterate; record trajectory
- [ ] **4.9** Write integration tests for the MCP server: schema validation, destructive enforcement, audit log integration

**Done when:** The MCP server is callable from any MCP client. The host-assistant LLM picks the right tool with the right args in the eval set. The eval trajectory is committed.

## Phase 5 — Frontends (2.5 weeks)

Two apps sharing a common UI/library layer. **Host/admin app**: desktop-and-mobile responsive, forms + chat panel. **Participant app**: mobile-first, PWA-installable, join/dish/score/reveal.

### 5A — Shared UI layer

- [ ] **5A.1** Shared `ui` package: design tokens (WCAG-AA contrast built in), base components (semantic HTML, `:focus-visible`, ARIA patterns, 44×44 touch targets, 16px inputs), API client, auth/session hooks, shared types re-export
- [ ] **5A.3** Shared accessibility primitives: keyboard-operable modal with focus-trap, `aria-live` region helper, skip-to-main link, accessible form-field wrapper (label + `aria-invalid` + `role="alert"` + blur/submit validation)
- [ ] **5A.2** Reveal view component (shared): used by both apps (host controls it, participants watch it)

### 5B — Host/admin app

- [ ] **5B.1** Project skeleton: routing, layout, responsive breakpoints
- [ ] **5B.2** Auth flows: host signup, host login, session persistence
- [ ] **5B.3** Host flows: contest list, contest creation (form), draft review
- [ ] **5B.4** Chat panel: WebSocket-less, polls the chat endpoint, shows tool calls and their results
- [ ] **5B.5** Confirmation UI for destructive tools: a clear "Confirm" beat before the call lands
- [ ] **5B.6** Host live flows: tally view, send-reminder trigger, reveal trigger, tie resolution
- [ ] **5B.7** Audit-log visibility: `sourcePath` filter, including `sourcePath="mcp"` entries with `toolName` and `toolArgs`

### 5C — Participant app

- [ ] **5C.1** Project skeleton: routing, mobile-first layout, PWA manifest + service worker
- [ ] **5C.2** Auth flows: join via code, set display name, remember-me token persistence
- [ ] **5C.3** Participant flows: list of dishes, dish submission, **adaptive score screen** (stepper/rating when repeats allowed; ranking/assignment UI when `uniquePerCategory` — invalid score impossible by construction; reads the materialized view), send-vote confirmation with double-submit prevention
- [ ] **5C.4** Reveal view: consume the shared reveal component; a deliberate beat with animation, names, scores, winners
- [ ] **5C.5** PWA: installable, offline-tolerant (read-only on cached contest state)

**Done when:** A 10-person contest can be run end-to-end — the host drives it from the host app (forms + chat panel), participants join/submit/score from the participant app. The chat panel shows tool calls and their results. Destructive tools require confirmation in the UI. The reveal feels like a moment on the participant app. Both apps pass `axe-core` checks (WCAG 2.1 AA) and are fully keyboard-operable.

## Phase 6 — Infrastructure and defense artifacts (1.5 weeks)

The defense is won or lost on the demo and the artifacts that back it. The infrastructure itself is AI-generated and is itself evaluated.

- [ ] **6.1** AI-generate the `Dockerfile` for the API, the MCP server, and the two frontends (`host-web`, `participant-web`). Document the prompt, the output, and the verification (build succeeds, tests pass)
- [ ] **6.2** AI-generate the `docker-compose.yml` for local development. Document and verify
- [ ] **6.3** AI-generate the **full CI pipeline**, extending the hand-written Phase 0 skeleton (0.10): build; run deterministic tests as a **hard gate** (unit + acceptance + mcp contract + frontend + E2E — any failure blocks); run the eval sets as a **threshold gate** (block only when a metric drops below its committed threshold) and report the trajectory; run `npm audit` (supply-chain gate); run `axe-core` via the Playwright E2E (accessibility hard gate). Document the before/after (skeleton vs. AI-generated) as part of the infra-generation artifact
- [ ] **6.4** AI-generate the CD pipeline (deploy on tag). Document and verify
- [ ] **6.5** Implement the infrastructure eval: builds, tests pass, deploys (dry-run), human-readable. Record metrics
- [ ] **6.6** README: how to run, how to test, how to evaluate, the architecture in one page
- [ ] **6.7** Architecture diagram: the API, the MCP server, the two frontends (host + participant), the chat panel, the audit log
- [ ] **6.8** Defense demo script: 15 minutes, the worked example end-to-end, both creation paths (form and chat), the host-assistant eval trajectory, the destructive-tool confirmation flow, the audit log
- [ ] **6.9** Eval trajectory document: prompt iteration logs, all three eval sets, all metrics over time
- [ ] **6.10** Threat model document: what the system defends against, mapped to the **OWASP Top 10** (see `design.md §11B.9`) — A01 ownership, A03 injection/schema, A04 destructive tools + rate limiting, A07 auth, A09 logging — plus the 2025 supply-chain category; what it doesn't defend against, and why
- [ ] **6.11** Security pass: input-validation review, authz (ownership + role) check on every endpoint, audit/security-event log integrity check, `npm audit` clean, Dependabot enabled, secrets-not-logged review
- [ ] **6.12** Accessibility pass (WCAG 2.1 AA): automated axe + Lighthouse clean, plus a manual checklist run — full keyboard-only navigation, screen-reader pass (VoiceOver/NVDA), 200%-zoom legibility — on both apps, especially the adaptive score screen and the reveal

**Done when:** the project can be cloned, run via `docker compose up`, and demoed in under 10 minutes by a stranger. The defense demo lands. The three AI surfaces are documented with their own eval trajectories.

## What is intentionally not in this list

- Course assignment. Out of scope for v1.
- Anonymous judging. Out of scope; the dish explanation requires the name.
- Native mobile apps. PWA covers the venue use case in v1.
- Real-time websockets. Polling is sufficient; the reveal is a single moment.
- Multi-tenant organizations. Single-tenant.
- Recipe sharing, social feeds, payment. None of these.
- Edit-after-send (host unlock). v2.
- Anonymous-until-reveal. v2.

## Time estimate

8–10 weeks for a single developer working full-time. The phases are not perfectly parallelizable — Phase 4 needs Phase 2's API; Phase 5 needs Phase 4's MCP server. But within a phase, the tasks can be reordered slightly to keep momentum.

## Open threads (resolved)

All open questions from the exploration phase are now resolved.

1. **Reveal strategy.** ✓ Both host-trigger and scheduled are supported in v1.
2. **Participant join.** ✓ Join code only, in v1.
3. **LLM defaults.** ✓ The LLM may propose values for fields the host did not mention, with a clearly-marked "LLM-suggested" badge.
4. **MCP exposure.** ✓ Internal (powers the chat panel) and external (any MCP client can connect with host credentials). One server, one tool surface.
5. **Deployment.** ✓ Cloud-shaped with a `docker compose up` local path. AI-generated infrastructure is itself a defense artifact with its own eval set.
