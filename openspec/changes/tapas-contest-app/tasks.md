# Tasks

This is the implementation plan for the Tapas Contest App. The ordering is deliberate: each task produces a runnable artifact that the next task depends on. There are no parallel tracks; the project is too small for that and the dependencies are too tight.

The project has **three AI surfaces**, each with its own eval set:

1. **Contest-creation LLM** — extracts `ContestDraft` from natural language. 25 cases.
2. **Host-assistant LLM** — picks MCP tools in response to host messages. 30+ cases.
3. **Infrastructure-generation AI** — produces Dockerfiles, CI pipeline, compose file. ~10 cases.

All three are governed by the same discipline: schema-validate the output, review it, version it, audit every action.

## Phase 0 — Skeleton (1–2 days)

The minimum scaffolding to start the project. Three services in one monorepo: `api`, `mcp`, `web`. Shared types package.

- [ ] **0.1** Initialize repo, TypeScript everywhere, monorepo layout (workspaces for `api`, `mcp`, `web`, `shared`)
- [ ] **0.2** Pick and commit the LLM provider; create an `LLMClient` interface in `shared` with a stub implementation
- [ ] **0.3** Pick and commit the persistence layer; create the migration runner in `api` and a single empty migration
- [ ] **0.4** Set up the test runner (backend: fast unit test runner; frontend: Vitest)
- [ ] **0.5** Create the `conftest` / shared types package so the model types are reused end-to-end (API, MCP, Web)
- [ ] **0.6** Define the `AuditEntry` type in `shared` and a thin audit-log interface in `api`
- [ ] **0.7** Set up the local infra: a `docker-compose.yml` stub with one service (the API) for now; full version lands in Phase 6

**Done when:** `npm test` runs and passes. `npm run dev` starts the API, the MCP server, and the Web UI. The Web UI can hit the API. The MCP server can hit the API.

## Phase 1 — The compiler (1 week)

The compiler is the load-bearing artifact of the project. Pure function, no I/O, no LLM. 50+ unit tests before anything else.

- [ ] **1.1** Define the model types (`Person`, `ContestDraft`, `ScoringConfig`, `Dish`, `MaterializedContest`) in `shared`
- [ ] **1.2** Implement the compiler signature: `compile(draft) -> MaterializedContest | CompileError`
- [ ] **1.3** Implement attribution: `per_person` and `per_couple` modes
- [ ] **1.4** Implement anti-bias: `none`, `couples`, `arbitrary_pairs` modes
- [ ] **1.5** Implement range resolution: fixed `{min, max}` and `auto`
- [ ] **1.6** Implement validation: relation consistency, non-empty ranges, no orphan partners
- [ ] **1.7** Write 50+ unit tests against the compiler, including the Strict and Joint variants from `design.md`
- [ ] **1.8** Add property-based tests: deterministic output, symmetric `allowedVoters`, valid per-voter range
- [ ] **1.9** Add a "golden" test corpus: hand-curated drafts with expected outputs, frozen as test fixtures

**Done when:** `npm test` runs 50+ compiler tests in under a second. The compiler has no external dependencies (no DB, no LLM, no network).

## Phase 2 — Backend API and DraftService (1.5 weeks)

The API is the source of truth. Every other component (Web UI, MCP server, chat) calls it. Persistence becomes real here.

- [ ] **2.1** Create the schema migrations: `persons`, `contests`, `contest_drafts`, `dishes`, `vote_sessions`, `scores`, `audit_log`
- [ ] **2.2** Implement the DraftService: create, read, update, delete on drafts
- [ ] **2.3** Implement the LLMClient: function-calling adapter that takes a host message and returns a parsed `ContestDraft` shape (or partial + clarifications)
- [ ] **2.4** Implement the two-phase contest-creation flow: extract → clarify → finalize
- [ ] **2.5** Implement draft validation: the backend's authoritative validator, separate from the LLM schema
- [ ] **2.6** Wire the audit log: every mutation writes an entry with `sourcePath` set by the request origin
- [ ] **2.7** Wire authentication: host signup, host login, host session token
- [ ] **2.8** Implement contest publish: invoke the compiler, persist the materialized constraint view as a JSON blob, generate the join code
- [ ] **2.9** Implement participant join: join code → display name → remember-me token
- [ ] **2.10** Implement dish submission, vote session, score writes (with runtime checks against the materialized view)
- [ ] **2.11** Implement close logic (all_sent / host_trigger / scheduled) and reveal logic
- [ ] **2.12** Implement read endpoints: `get_contest`, `get_tally`, `get_results`
- [ ] **2.13** Write integration tests for the API: form path, LLM path, partial + clarify, schema-rejection on adversarial inputs, full Strict-variant flow

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

## Phase 5 — Frontend (2 weeks)

Mobile-first responsive. PWA-installable. Three surfaces: form-driven host flows, score screen, chat panel.

- [ ] **5.1** Project skeleton: routing, layout, mobile breakpoints, PWA manifest
- [ ] **5.2** Auth flows: host signup, host login, session persistence
- [ ] **5.3** Host flows: contest list, contest creation (form), draft review
- [ ] **5.4** Chat panel: WebSocket-less, polls the chat endpoint, shows tool calls and their results
- [ ] **5.5** Confirmation UI for destructive tools: a clear "Confirm" beat before the call lands
- [ ] **5.6** Participant flows: join via code, set display name, list of dishes, score screen, send-vote confirmation
- [ ] **5.7** Host live flows: tally view, send-vote trigger, reveal trigger, tie resolution
- [ ] **5.8** Reveal screen: a deliberate beat. Animation, names, scores, winners
- [ ] **5.9** PWA: installable, offline-tolerant (read-only on cached contest state), manifest + service worker
- [ ] **5.10** Audit-log visibility: the host can see the audit log, with `sourcePath` filter, including `sourcePath="mcp"` entries with `toolName` and `toolArgs`

**Done when:** A 10-person contest can be run end-to-end from a Web UI and a chat panel. The chat panel shows tool calls and their results. Destructive tools require confirmation in the UI. The reveal feels like a moment.

## Phase 6 — Infrastructure and defense artifacts (1.5 weeks)

The defense is won or lost on the demo and the artifacts that back it. The infrastructure itself is AI-generated and is itself evaluated.

- [ ] **6.1** AI-generate the `Dockerfile` for the API, the MCP server, and the Web UI. Document the prompt, the output, and the verification (build succeeds, tests pass)
- [ ] **6.2** AI-generate the `docker-compose.yml` for local development. Document and verify
- [ ] **6.3** AI-generate the CI pipeline (GitHub Actions or equivalent): build, test, run both eval sets, report metrics
- [ ] **6.4** AI-generate the CD pipeline (deploy on tag). Document and verify
- [ ] **6.5** Implement the infrastructure eval: builds, tests pass, deploys (dry-run), human-readable. Record metrics
- [ ] **6.6** README: how to run, how to test, how to evaluate, the architecture in one page
- [ ] **6.7** Architecture diagram: the API, the MCP server, the Web UI, the chat panel, the audit log
- [ ] **6.8** Defense demo script: 15 minutes, the worked example end-to-end, both creation paths (form and chat), the host-assistant eval trajectory, the destructive-tool confirmation flow, the audit log
- [ ] **6.9** Eval trajectory document: prompt iteration logs, all three eval sets, all metrics over time
- [ ] **6.10** Threat model document: what the system defends against (injection through schema, destructive tools, auth bypass), what it doesn't, why
- [ ] **6.11** Security pass: input validation review, auth check on every endpoint, audit log integrity check

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
