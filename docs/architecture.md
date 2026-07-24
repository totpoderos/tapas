# Tapas — Architecture

*Defense artifact for task 6.7. The system in diagrams: the API, the MCP server,
the two frontends, the chat panel, and the audit log — plus the flows that carry
the thesis argument (one authorization authority, three entry points, every action
audited, destructive actions confirmed).*

Diagrams are [Mermaid](https://mermaid.js.org) and render natively on GitHub, so
they stay text-versioned and reviewable alongside the code.

---

## 1. System context

The one-screen view: who talks to what, and where the trust boundary sits.

```mermaid
flowchart TB
    subgraph clients["Clients"]
        HW["<b>Host / admin app</b><br/>React SPA<br/>forms · chat panel<br/>control room · audit log"]
        PW["<b>Participant app</b><br/>React SPA, mobile-first<br/>join · dish · score · reveal"]
        MC["<b>External MCP client</b><br/>e.g. Claude Desktop"]
    end

    subgraph edge["Edge (production)"]
        CADDY["<b>Caddy</b><br/>TLS termination<br/>sets X-Forwarded-Proto"]
    end

    subgraph trust["Trust boundary — the API is the only authority on authorization"]
        API["<b>Backend API</b> (Fastify)<br/>authn · <b>ownership authz</b> · validation<br/>rule compiler · use cases"]
        MCP["<b>MCP server</b><br/>thin protocol adapter<br/><i>no business logic, no authz</i>"]
        DB[("SQLite<br/>contests · votes<br/>audit log · security events")]
    end

    LLM["<b>LLM</b><br/>any OpenAI-compatible<br/>/chat/completions"]

    HW -->|"httpOnly cookie<br/>(same-origin proxy)"| CADDY
    PW -->|"httpOnly cookie<br/>(same-origin proxy)"| CADDY
    CADDY --> API
    MC -->|"MCP over <b>stdio</b>"| MCP
    MCP -->|"HTTP + <b>Bearer PAT</b><br/>(re-enters the public API)"| API
    API --> DB
    API -.->|"tool-calling<br/>(output re-validated)"| LLM

    classDef authority fill:#1f6f43,stroke:#0d3b23,color:#fff
    classDef untrusted fill:#8a5a00,stroke:#4d3200,color:#fff
    class API authority
    class LLM untrusted
```

**The load-bearing property:** every path — browser, external MCP client, or the
in-app assistant — ends up executing the *same* API routes, so authentication,
ownership checks, validation, and auditing happen **exactly once**, in one place.
The MCP server deliberately holds no business logic and makes no authorization
decision of its own; it is a protocol adapter that speaks to the API like any
other client.

---

## 2. The three entry points

Design.md §7 calls for three ways into the system. They converge by construction.

```mermaid
flowchart LR
    subgraph entry["Three entry points"]
        E1["<b>1. HTTP</b><br/>the two SPAs<br/>session cookie"]
        E2["<b>2. MCP server</b><br/>external client<br/>host PAT (Bearer)"]
        E3["<b>3. Chat assistant</b><br/>in-app panel<br/>same session cookie"]
    end

    ROUTES["<b>API routes</b><br/>requireHostSession / requireVoterSession<br/>→ ownership check → use case"]

    E1 -->|"fetch"| ROUTES
    E2 -->|"HTTP + Bearer"| ROUTES
    E3 -->|"<b>app.inject</b><br/>forwarding the host's cookie"| ROUTES

    ROUTES --> UC["Use cases + domain"]
    UC --> AUDIT[("Audit log<br/>one projection<br/>of every action")]

    classDef converge fill:#1f6f43,stroke:#0d3b23,color:#fff
    class ROUTES converge
```

Entry point 3 is the subtle one: rather than re-implementing tool execution, the
in-app assistant **dispatches the chosen tool back through the same API** via
`app.inject`, forwarding the signed-in host's session cookie
([assistant-routes.ts](../packages/api/src/http/assistant-routes.ts)). One
execution path, so a rule can never be enforced in one entry point and missed in
another.

---

## 3. Authorization: the ownership check

`401` = not authenticated · `403` = authenticated but not permitted.

```mermaid
flowchart TB
    REQ["Request"] --> AUTHN{"Credential?"}
    AUTHN -->|"none / invalid"| R401["<b>401</b>"]
    AUTHN -->|"session cookie<br/><i>or</i> Bearer PAT"| ACTIVE{"Session still<br/>active / PAT<br/>not revoked?"}
    ACTIVE -->|"no"| R401
    ACTIVE -->|"yes"| SCOPE{"Scope"}

    SCOPE -->|"host"| OWN{"<b>Does this host<br/>own the target?</b>"}
    SCOPE -->|"voter"| CONTEST{"Token's contestId<br/>== route contestId?"}

    OWN -->|"no"| R403["<b>403</b>"]
    OWN -->|"yes"| OK["Execute use case<br/>→ record audit entry"]
    CONTEST -->|"no"| R403
    CONTEST -->|"yes"| OK

    classDef deny fill:#8c2f2f,stroke:#4d1919,color:#fff
    classDef allow fill:#1f6f43,stroke:#0d3b23,color:#fff
    class R401,R403 deny
    class OK allow
```

Role alone is never enough: a host operation verifies the host **owns** the target
contest or draft; a voter operation verifies the voter belongs to *that* contest.
See [threat-model.md §3.1](threat-model.md) for the code references.

---

## 4. Destructive actions: propose → confirm → act

The thesis centrepiece — "AI proposes, the host confirms". Nothing destructive
runs on the model's say-so.

```mermaid
sequenceDiagram
    actor Host
    participant Panel as Chat panel
    participant API as API (/assistant/messages)
    participant LLM
    participant Routes as API routes
    participant Audit as Audit log

    Host->>Panel: "close the tapas night contest"
    Panel->>API: POST message
    API->>LLM: message + tool catalog
    LLM-->>API: proposes close_contest(id)
    Note over API: destructive → do NOT execute.<br/>Mint an action-bound HMAC<br/>over (tool + exact args)
    API-->>Panel: {kind:'confirm', action, args, confirmationToken}
    Panel-->>Host: focus-trapped confirmation card<br/>focus starts on Cancel — Escape cancels

    alt Host cancels
        Host->>Panel: Escape / Cancel
        Note over Panel,Routes: nothing runs — no state change
    else Host confirms
        Host->>Panel: Yes
        Panel->>API: POST {confirm:{action,args,confirmationToken}}
        Note over API: verify HMAC (timing-safe).<br/>NO model call on this leg
        API->>Routes: app.inject + cookie<br/>+ x-tapas-confirmation: host
        Routes->>Routes: ownership check
        Routes->>Audit: contest.closed<br/>confirmation = 'host'
        Routes-->>Panel: result ticket
        Panel-->>Host: "✓ closed — now closed"
    end
```

Three properties make this more than a UI nicety:

1. **The token is action-bound.** It is an HMAC over the tool name *and* its exact
   arguments, so a token minted to close contest A cannot close contest B.
2. **The confirm leg runs no model.** It validates the token and dispatches —
   the model cannot influence what happens after the host says yes.
3. **The same gate exists on the MCP path.** An external MCP client gets
   `confirmationRequired` instead of execution
   ([mcp-server.ts](../packages/mcp/src/mcp-server.ts)), so the protection is a
   property of the system, not of one UI.

---

## 5. The audit log as an event projection

Every action, from every entry point, lands in **one** log.

```mermaid
flowchart LR
    subgraph sources["Where actions come from"]
        F["Form / SPA"]
        M["MCP / assistant tool"]
        S["System<br/>(e.g. publish)"]
    end

    UC["Use case<br/>(domain aggregate)"] --> EV["<b>DomainEvent</b><br/>pure, no request context"]
    F --> UC
    M --> UC
    S --> UC

    EV --> PROJ["<b>Audit projection</b><br/>enriches with request-path metadata"]
    PROJ --> ENTRY["<b>AuditEntry</b><br/>sourcePath: form │ mcp │ system<br/>confirmation: host │ auto<br/>actor · occurredAt<br/>toolName/toolArgs (mcp)"]
    ENTRY --> VIEW["Host activity-log screen<br/>filterable by source"]

    classDef pure fill:#2b5797,stroke:#16304f,color:#fff
    class EV pure
```

The domain emits **pure events** that know nothing about HTTP; the application
layer projects them into `AuditEntry`, attaching the provenance the domain cannot
know ([audit-entry.ts](../packages/shared/src/audit/audit-entry.ts)). That is what
makes "who did this, through which path, and did a human confirm it?" answerable
for *every* action — including ones an AI proposed.

---

## 6. Package structure

```mermaid
flowchart TB
    subgraph apps["Services & apps"]
        API["<b>api</b><br/>Fastify, use cases,<br/>routes, repositories"]
        MCP["<b>mcp</b><br/>MCP adapter +<br/>host assistant"]
        HW["<b>host-web</b>"]
        PW["<b>participant-web</b>"]
    end

    subgraph libs["Libraries"]
        DOM["<b>domain</b><br/><i>pure — zero I/O</i><br/>rule space + compiler<br/><i>(lint-enforced)</i>"]
        SH["<b>shared</b><br/>types across the wire"]
        UI["<b>ui</b><br/>design tokens +<br/>accessible components"]
        EV["<b>evals</b><br/>eval harness +<br/>threshold gate"]
    end

    API --> DOM
    API --> SH
    API --> MCP
    MCP --> SH
    HW --> UI
    HW --> SH
    PW --> UI
    PW --> SH
    EV --> API
    EV --> MCP

    classDef pure fill:#2b5797,stroke:#16304f,color:#fff
    class DOM pure
```

`domain` has **zero I/O** — no DB, no network, no LLM — enforced by an ESLint rule,
which is what lets the rule compiler be tested as a pure function (including
property-based tests) with no infrastructure at all.

> Note the `api → mcp` edge: the API reuses the MCP tool catalog and HMAC gate for
> the in-app assistant. The reverse dependency (`mcp → api`) is **dev-only** (test
> harness), so there is no production cycle.

---

## 7. Deployment

```mermaid
flowchart TB
    subgraph ci["CI — every PR"]
        G1["hard gate<br/>typecheck · lint · 935 tests<br/>+ supply-chain audit"]
        G2["a11y hard gate<br/>axe-core in Playwright E2E"]
        G3["threshold gate<br/>eval suites vs committed floors<br/><i>schedule/dispatch</i>"]
    end

    subgraph cd["CD — on a v* tag"]
        IMG["build + push 4 images<br/>→ GHCR"]
        DEP["render production manifest<br/>(dry-run deploy)"]
    end

    subgraph prod["Production stack"]
        C["Caddy — automatic TLS"]
        A["api (NODE_ENV=production)"]
        H["host-web"]
        P["participant-web"]
        V[("named volume<br/>SQLite")]
    end

    G1 --> IMG
    G2 --> IMG
    IMG --> DEP
    DEP -.-> prod
    C --> A
    C --> H
    C --> P
    A --> V
```

Caddy is the single TLS edge and proxies the API path prefixes **directly** to the
API (setting `X-Forwarded-Proto: https`), so the API's production HTTPS redirect
does not loop and its `Secure` cookies ride a real TLS origin. Details and the
verification record are in [infra-generation.md](infra-generation.md).

---

## Related documents

- [threat-model.md](threat-model.md) — OWASP Top 10 mapping, with code references and named gaps
- [infra-generation.md](infra-generation.md) — how the Docker/compose/CI/CD artifacts were generated and verified
- [eval-trajectory.md](eval-trajectory.md) · [host-assistant-eval-trajectory.md](host-assistant-eval-trajectory.md) — the AI surfaces, measured
- [design.md](../openspec/changes/tapas-contest-app/design.md) — the full design record
