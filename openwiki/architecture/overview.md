# Architecture overview

Full Mermaid diagrams (system context, three entry points, the ownership check,
the propose→confirm→act sequence, the audit projection, and the package graph)
live in [`docs/architecture.md`](../../docs/architecture.md) — this page explains
*why* the shape is what it is and links to the load-bearing source files. Read
the diagrams there alongside this page.

## One API, two scopes, three entry points

**One backend API** (`packages/api`, Fastify + `node:sqlite`) is the single
source of truth and the *only* authority on authorization. It exposes two
auth scopes — `host` and `voter`. A host may additionally hold the `admin`
role, which guards administrative work
(`packages/api/src/http/require-administrator.ts`); the role is read from the
account store rather than the session, so a demotion takes effect at once
instead of riding an old token claim.

Three distinct paths reach the same API routes:

1. **HTTP** — the two React SPAs (`host-web`, `participant-web`) call the API
   directly over an httpOnly session cookie, proxied same-origin so no CORS/token
   ever touches JS.
2. **MCP server** (`packages/mcp`) — a thin protocol adapter with **no business
   logic and no authorization decision of its own**. An external MCP client
   (e.g. Claude Desktop) talks to it over stdio; it re-enters the public API over
   HTTP with a host-issued Bearer **personal access token** (PAT).
3. **In-app chat assistant** — the host panel's chat feature. Rather than
   re-implementing tool execution, it dispatches the LLM's chosen tool back
   through the *same* API routes via Fastify's `app.inject`, forwarding the
   signed-in host's session cookie
   ([`assistant-routes.ts`](../../packages/api/src/http/assistant-routes.ts),
   [`host-assistant-turn.ts`](../../packages/api/src/assistant/host-assistant-turn.ts)).

**The load-bearing property:** because all three paths execute the same routes,
authentication, ownership checks, input validation, and audit logging happen
**exactly once**, in one place. A rule can never be enforced on one entry point
and missed on another — this is the central thesis argument the security and AI
sections both build on.

## Authorization: role is necessary, ownership is what matters

`401` = not authenticated; `403` = authenticated but not permitted. Every
protected host route checks not just "is this a host?" but **"does this host own
the target contest/draft?"** — see
[`require-host-session.ts`](../../packages/api/src/http/require-host-session.ts).
Voter routes check that the voter's token `contestId` matches the route's
`contestId` ([`require-voter-session.ts`](../../packages/api/src/http/require-voter-session.ts)).
Role alone is never sufficient; ownership/scope match is the actual gate. Full
detail and code references: [`docs/threat-model.md`](../../docs/threat-model.md) §3.1.

## Destructive actions: propose → confirm → act

Close, publish, reveal, and delete are **destructive** — nothing destructive runs
on the model's say-so alone. When the assistant (or an external MCP client)
proposes one of these tools, the server does not execute it; it mints an
action-bound HMAC over the exact tool name and arguments and hands back a
confirmation request. Only a follow-up request carrying the matching token
executes the action — and that confirm leg **runs no model call**, so nothing
about what happens next is influenced by the LLM. This is enforced in three
places:

- The MCP server refuses to dispatch a destructive tool without a valid token
  ([`mcp-server.ts`](../../packages/mcp/src/mcp-server.ts),
  [`confirmation-token.ts`](../../packages/mcp/src/confirmation-token.ts)).
- The in-app assistant surfaces a focus-trapped confirmation card in the chat
  panel (`packages/host-web/src/pages/chat.tsx`).
- The API records *who* confirmed it (`confirmation: 'host' | 'auto'` on the
  audit entry).

A token is scoped to one action's exact arguments, so a token minted to close
contest A cannot close contest B. Known limitation: the token has no nonce
store, so a captured token is technically replayable (bounded in practice — a
replayed delete just hits `CONTEST_NOT_FOUND`) — recorded in
[`docs/backlog.md`](../../docs/backlog.md) and
[`docs/threat-model.md`](../../docs/threat-model.md) §3.9.

See [workflows/contest-lifecycle.md](../workflows/contest-lifecycle.md) for the
end-to-end sequence, and [integrations/ai-surfaces.md](../integrations/ai-surfaces.md)
for how the assistant chooses tools in the first place.

## The audit log as an event projection

Every action, from every entry point, lands in **one** log. Domain aggregates
emit pure `DomainEvent`s that know nothing about HTTP
(`packages/shared/src/audit/audit-entry.ts` defines the shape); the application
layer projects them into an `AuditEntry` that attaches the provenance the domain
cannot know: `sourcePath: form | mcp | system`, `confirmation: host | auto`,
actor, timestamp, and (for MCP-originated actions) `toolName`/`toolArgs`
(`packages/api/src/audit/audit-projection.ts`). This is what makes "who did
this, through which path, and did a human confirm it?" answerable for *every*
action, including ones an AI proposed. The host's activity-log screen
(`packages/host-web/src/pages/audit-log.tsx`) reads and filters this projection.

## Package graph and the domain-purity boundary

```
apps/services:  api  ·  mcp  ·  host-web  ·  participant-web
libraries:      domain (pure, zero I/O)  ·  shared  ·  ui  ·  evals

api    → domain, shared, mcp   (reuses the MCP tool catalog + HMAC gate for the in-app assistant)
mcp    → shared                (mcp → api is dev-only test harness; no production cycle)
host-web, participant-web → ui, shared
evals  → api, mcp
```

`packages/domain` has **zero I/O** — no DB, no network, no LLM calls — and this
is enforced by an ESLint rule, not just convention. That purity is what lets the
rule compiler (`compile()`, see [domain-model.md](domain-model.md)) be tested as
a pure function, including property-based tests, with no infrastructure spun up
at all. When changing anything in `domain`, if a change seems to need I/O, that
is a signal the concern belongs in `api`'s use-case layer instead.

`packages/shared` carries types across the wire (DTOs, the audit-entry shape,
the provider-agnostic `LLMClient` interface) — anything both frontends and the
backend need to agree on without duplicating.

## Composition root

`packages/api/src/composition.ts` (`buildProductionDeps`) is where every
concrete repository, use case, and adapter gets wired together from a real
SQLite connection and validated environment. If you're tracing "where does X get
constructed", start there — it is the single place all use cases are assembled,
which makes swapping an implementation (e.g. a different `Mailer`, or a fake
`LLMClient` for tests) a one-line change at the edge rather than a scattered
refactor.

## Configuration

All configuration is environment variables, Zod-validated at startup — the
process refuses to boot on missing/invalid config
(`packages/api/src/config/env.ts`), and production additionally refuses to boot
if secrets are left at their committed dev defaults. See
[operations/security-and-ops.md](../operations/security-and-ops.md) for the full
config reference and [`.env.example`](../../.env.example).
