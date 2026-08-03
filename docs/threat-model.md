# Tapas — Threat Model (OWASP Top 10)

*Defense artifact for task 6.10. Security is this project's curriculum anchor
(design.md §11B); this document states what Tapas defends against — with
references to the actual code — and, just as importantly, **what it does not
defend against and why**. It is written from the code as built, not from design
intent: where the design promised a control that is not implemented, that is
recorded as a gap, not glossed.*

Mapped against the **OWASP Top 10 : 2025** (the current list, which adds *Software
Supply Chain Failures* and *Mishandling of Exceptional Conditions* and reorders
the rest), cross-referenced to the 2021 `A0x` codes design.md §11B.9 uses.

---

## 1. System, assets, and trust boundaries

**One API is the single source of truth and the sole authorization authority.**
Everything else is a client of it.

```
                          ┌─────────────────────────── trust boundary: the API ───────────────────────────┐
  Host browser  ──cookie──▶│  Fastify API (packages/api)                                                    │
  (host-web SPA)           │   • helmet, CORS allowlist, HTTPS redirect, rate limit                         │
                           │   • requireHostSession / requireVoterSession  ── ownership checks ──▶  SQLite  │
  Participant   ──cookie──▶│   • use cases (domain) → repositories (parameterized SQL)                      │
  (participant-web SPA)    │   • audit log + security-event log (event projections)                        │
                           │                                                                                │
  External MCP   ─Bearer──▶│  ◀── in-app assistant re-enters via app.inject (same routes, same authz)      │
  client (PAT)   PAT       │  ◀── external MCP server dispatches via HTTP+Bearer (no authz of its own)     │
                          └────────────────────────────────────────────────────────────────────────────────┘
       ▲                                                        │
       └──────────────── untrusted input crosses here ─────────┘
         participant display names, dish text, LLM output, join codes, request bodies
```

**Assets to protect:** host account credentials & sessions; contest integrity
(only the owner may close/reveal/configure); vote integrity (one voter, their own
ballot, no cross-contest access); the audit trail; the destructive-action
confirmation channel; secrets (JWT/HMAC keys, PATs).

**Primary trust boundaries:** (1) browser ↔ API (cookies, CORS); (2) external MCP
client ↔ API (PAT bearer); (3) the API ↔ the LLM and participant-authored text
(**both untrusted** — the model can be induced, names can carry injection); (4)
the process ↔ its configuration/secrets (env).

**Principals:** `admin` (one per deployment, named in configuration before first
boot and claimed once), `host` (owns their contests), `voter` (scoped to one
contest).

---

## 2. OWASP 2025 → Tapas mapping (at a glance)

| # | OWASP 2025 (2021 code) | Principal defenses in Tapas | Verdict |
|---|---|---|---|
| 1 | Broken Access Control (A01) | Backend authz on every request; **ownership** checks; administrative work role-gated, and never reachable by PAT; MCP has no authz of its own | Strong |
| 2 | Security Misconfiguration (A05) | Helmet; CORS allowlist (never `*`); generic prod errors; env fail-fast | Strong; CSP/HSTS via Helmet defaults |
| 3 | Software Supply Chain Failures (2025) | `npm audit` CI gate w/ expiring allowlist; committed lockfile; `npm ci` | Strong; **no Dependabot** |
| 4 | Cryptographic Failures (A02) | bcrypt 12; HS256 via `node:crypto` + timing-safe compare; httpOnly+Secure cookies | Strong; **weak secret enforcement** |
| 5 | Injection (A03) | Parameterized SQL (zero string-built); two-phase LLM validation; participant-name guard | Strong |
| 6 | Insecure Design (A04) | Destructive-tool confirmation ×3 layers (HMAC); rate limiting; least-privilege scoping | Strong; replayable token |
| 7 | Authentication Failures (A07) | 12-char complex password policy; **account lockout 5/15m**; refresh rotation; generic errors | Strong |
| 8 | Software/Data Integrity Failures (A08) | Action-bound HMAC on destructive ops; committed lockfile + integrity install; two-phase validation | Strong; audit log not signed |
| 9 | Logging & Alerting Failures (A09) | Auth security-event log (actor+IP+time); unified audit log; no secrets logged | Logging strong; **no alerting** |
| 10 | Mishandling of Exceptional Conditions (2025) | Env fail-fast; generic prod errors (no stack traces); fail-closed rate-limit & audit gate | Strong |

Detail and evidence per category follow. `path:line` references are to the code
as of this writing.

---

## 3. Defenses in depth (by category)

### 3.1 Broken Access Control — A01 *(the primary control)*

- **Authenticated on every protected request.** `requireHostSession`
  ([require-host-session.ts:37](../packages/api/src/http/require-host-session.ts)) accepts
  *either* the httpOnly `access_token` cookie (verified, then checked live against
  the `SessionStore`) *or* an `Authorization: Bearer <PAT>` (hash lookup, must not
  be revoked). In-app session and external PAT resolve to the **same**
  `{id, role}` and the **same** downstream checks — one authorization path, two
  credentials. `requireVoterSession`
  ([require-voter-session.ts:30](../packages/api/src/http/require-voter-session.ts))
  requires a voter token whose `contestId` claim equals the route's `:contestId`
  (`401` = unauthenticated, `403` = a token for a *different* contest).
- **Ownership is the real check, enforced in the backend.** Every host contest
  operation verifies `contest.hostId === request.hostSession.id` before acting —
  get / close / reveal / results / tally / audit all guard at the route
  ([contest-routes.ts:63,85,103,130,157,181](../packages/api/src/http/contest-routes.ts)),
  returning `403` otherwise. Draft operations check ownership *inside* the use
  case via `findOwnedDraft()`
  ([drafts/use-cases/shared.ts:31](../packages/api/src/drafts/use-cases/shared.ts)).
  `ListMyContests` is scoped to the caller's `hostId` and can never return another
  host's data.
- **The MCP server makes no authorization decision.** It dispatches every call to
  the API over HTTP carrying the host's PAT
  ([api-dispatcher.ts:32](../packages/mcp/src/api-dispatcher.ts)); the in-app
  assistant re-enters the same routes via `app.inject`, forwarding the session
  cookie ([assistant-routes.ts:54](../packages/api/src/http/assistant-routes.ts)).
  Both funnel through the checks above — there is no second, weaker path **for
  authorization**. That qualifier is deliberate: see the note below on how the
  two paths once diverged on *validation*.

> **Same routes ≠ same checks — a gap this document previously papered over.**
> "Both re-enter the same routes" was written about **authorization**, and for
> authorization it held. It did **not** hold for **input validation**. The MCP
> server hands each tool's `inputSchema` to the SDK, which validates arguments
> before the tool runs; the in-app assistant dispatched `tool.toRequest(
> call.arguments)` **directly**, so a model's malformed arguments reached the API
> unchecked. That is not hypothetical — it is how drafts came to hold participants
> with `id: undefined`, unaddressable for pairing and failing publish with
> `DUPLICATE_PERSON_ID "undefined"`. **Closed** by `parseToolArguments` in the tool
> catalog ([tool-catalog.ts](../packages/mcp/src/tool-catalog.ts)), now applied by
> both entry points and on both the reversible and the confirm legs of the
> assistant. The lesson generalises past this one bug: *two paths that share a
> destination still have to be shown to share each check individually* — see the
> recurring-asymmetry note in §4.

**Residual risk / gap:** contest `get/close/reveal` use cases carry no *internal*
ownership check — it lives only at the route — so a future non-route caller of
those use cases would bypass it (drafts do not have this weakness). Tracked for
6.11 as G6. The residual risk around roles is no longer the absence of one: it
is that a deployment has exactly one administrator and nothing transfers the
role, recorded as G10.

> **This paragraph outlived its own gap.** It read "the `admin` role and a
> `requireRole()` middleware named in the design do **not** exist (see §4)" for
> some time after §4 recorded G3 as **CLOSED** — so this document contradicted
> itself, and a generated wiki repeated the wrong half of it. Administrative work
> has been a guarded category since
> [require-administrator.ts](../packages/api/src/http/require-administrator.ts)
> landed. One clause of the original was accurate and is worth keeping: there is
> no generic `requireRole()`. What exists is `requireAdministrator`, a guard for
> the one role beyond `host` and `voter`; a parameterised middleware with a
> single possible argument would have been indirection, not design. The failure
> here is the ordinary one — a gap was closed in the table and the prose that
> pointed at it was not re-read.

### 3.2 Security Misconfiguration — A05

- **Helmet** is registered on the API with `X-Frame-Options: DENY`
  ([server.ts:30](../packages/api/src/server.ts)); its other secure defaults
  (`X-Content-Type-Options`, `Referrer-Policy`, HSTS, a baseline CSP) apply.
- **CORS is an explicit allowlist** of the two known frontend origins with
  `credentials: true` — never `origin: '*'`
  ([server.ts:31](../packages/api/src/server.ts), origins from
  [env.ts:13](../packages/api/src/config/env.ts)).
- **Generic errors in production**: unhandled errors return
  `{code:'INTERNAL_ERROR', message:'Something went wrong.'}` with the real error
  logged server-side only — no stack traces to the client
  ([error-handling.ts:8](../packages/api/src/http/error-handling.ts)).
- **Fail-fast configuration**: both the API and MCP validate env with Zod at
  startup and refuse to boot on invalid config, reporting only the offending keys
  ([api env.ts:35](../packages/api/src/config/env.ts),
  [mcp env.ts:22](../packages/mcp/src/config/env.ts)).

**Residual risk:** CSP and HSTS ride Helmet's defaults rather than being explicitly
tuned (max-age/preload, script-src). Acceptable, but not hardened — noted for 6.11.

### 3.3 Software Supply Chain Failures — *new in 2025*

- **CI supply-chain gate**: `npm run audit:ci`
  ([scripts/audit-gate.mjs](../scripts/audit-gate.mjs)) blocks the build on any
  **high/critical** advisory not covered by a **justified, expiring** allowlist
  entry ([.audit-allowlist.json](../.audit-allowlist.json)); expired entries stop
  suppressing (forcing re-review), new/unlisted highs block. Wired into the hard
  gate ([ci.yml](../.github/workflows/ci.yml)).
- **Committed lockfile + integrity installs**: `package-lock.json` is committed
  and CI uses `npm ci` (exact, lockfile-verified installs).

**Residual risk / gap:** **Dependabot is not configured** (`.github/dependabot.yml`
absent) despite the design; updates are currently manual. Two moderate advisories
remain ungated by policy. Tracked for 6.11.

### 3.4 Cryptographic Failures — A02

- **Passwords**: bcrypt at **12 rounds**
  ([password-hasher.ts:11](../packages/api/src/auth/password-hasher.ts)) — never
  stored plaintext.
- **Tokens**: JWTs signed **HS256 by hand** over `node:crypto` HMAC-SHA256, verified
  with `timingSafeEqual` and an expiry check
  ([token-issuer.ts:41](../packages/api/src/auth/token-issuer.ts)); access **15 min**,
  refresh **7 days**. PATs are 32 random bytes stored as SHA-256
  ([pat-hasher.ts](../packages/api/src/auth/pat-hasher.ts)) — a fast hash is fine
  for a high-entropy random token.
- **Cookies**: all session/voter cookies are `httpOnly`, always. Their transport
  attributes follow the environment
  ([cookieTransportFor](../packages/api/src/http/session-cookies.ts)):
  `Secure + SameSite=None` everywhere except an explicitly `development`
  environment, which gets `SameSite=Lax` and no `Secure`. No token is ever in JS
  either way (XSS-resistant), and `SameSite=None` is deliberate (cross-origin
  frontends) and always paired with `Secure`.

  **Why it is conditional, and why the condition is written the way it is.**
  Marking the cookie `Secure` unconditionally broke Safari: it refuses to keep a
  `Secure` cookie served over plain HTTP, and Chrome's exception for `localhost`
  is Chrome's alone. A participant on Safari joined a contest, was shown as
  joined (the app remembers who they are on the device, separately from the
  session), and then had every authenticated request refused — surfacing as
  "Your dish couldn't be saved". Development is same-origin anyway, because the
  dev servers proxy the API under each app's own origin, so `Lax` is both
  sufficient and correct there.

  The test is `nodeEnv === 'development'`, **not** `!== 'production'`. An unset,
  misspelt or unfamiliar environment therefore lands on the strict setting; the
  only way to weaken the cookie is to say `development` outright, and `env.ts`
  validates `NODE_ENV` against a closed enum at startup besides. A unit test
  asserts the attributes actually emitted for production, test, development and
  an unrecognised value
  ([session-cookies.test.ts](../packages/api/tests/unit/http/session-cookies.test.ts)).
  Do not "tidy" this back to an unconditional `true`, and do not loosen the
  condition to `=== 'production'`.
- **Transport**: production forces HTTP→HTTPS
  ([https-redirect.ts:8](../packages/api/src/http/https-redirect.ts)) with
  `trustProxy` so `X-Forwarded-Proto` is honored behind the TLS edge (Caddy, 6.4).

- **Helmet's defaults presume TLS, and two of them break plain-HTTP development.**
  `Strict-Transport-Security` and the CSP's `upgrade-insecure-requests` are sent
  in production and **withheld when the environment is explicitly `development`**
  ([server.ts](../packages/api/src/server.ts)). Safari applies HSTS to
  `localhost`; Chrome special-cases localhost and ignores it. One response pins
  localhost to HTTPS for a **year, across every port**, and the pin is not cleared
  by clearing cookies — a developer who hits it has to delete
  `~/Library/Cookies/HSTS.plist`. `upgrade-insecure-requests` meanwhile reissues
  http:// requests as https://, which nothing in development is listening for.

  The gate is `security.isDevelopment`, deliberately **not** `!isProduction` —
  the same fail-closed rule as the session cookie, so `staging` or an unset
  environment stays hardened. Everything else in the policy is unchanged in both
  environments, and a test asserts exactly that
  ([security-headers.test.ts](../packages/api/tests/unit/http/security-headers.test.ts)).

- **One engine is not "the browser".** That Safari defect reached a real device
  because the whole-system tests ran **Chromium only** — the one engine whose
  `localhost` exception hid it. This is the same "two paths assumed equivalent"
  shape recorded in §4, with browsers as the two paths: 87 passing end-to-end
  tests said nothing about the engine every iPhone actually runs. WebKit now
  covers the participant journey in the test matrix
  ([playwright.config.ts](../playwright.config.ts)), scoped there deliberately
  because that app is mobile-first and on iOS every browser is WebKit underneath.
  The host app is not yet covered by a second engine, and its session cookie had
  the identical defect.

**Residual risk / gap (HIGH):** `JWT_SECRET` enforces only `min(1)` — no length
floor (design said 64+); and `ASSISTANT_CONFIRMATION_SECRET` ships a **committed,
publicly-known default** and no required override, so a deployment that forgets to
set it keys the destructive-action HMAC with a secret that is in the repo. (MCP's
secrets are correctly required at `min(32)` with no default.) These are the
highest-value quick fixes — see §4 and §5.

### 3.5 Injection — A03

- **Parameterized SQL everywhere.** Every repository uses
  `db.prepare(...).run/get/all(...)` with `?` placeholders (e.g.
  [vote-session-repository.ts:66](../packages/api/src/db/vote-session-repository.ts),
  [host-account-repository.ts:52](../packages/api/src/db/host-account-repository.ts)).
  A search for template-literal SQL interpolation returns zero hits.
- **The LLM and participant text are treated as untrusted, with two-phase
  validation.** (1) Structural: the extraction tool schemas set
  `additionalProperties:false` at every level and Zod `.strict()`
  ([contest-draft-tool.ts](../packages/api/src/drafts/extraction/contest-draft-tool.ts));
  (2) Semantic: the API re-validates each field itself and **reads only known
  keys**, so smuggled fields are discarded
  ([proposed-draft-guard.ts:66](../packages/api/src/drafts/extraction/proposed-draft-guard.ts)).
  Note this covers the *draft-extraction* path. The *tool-calling* path is
  validated separately, by each tool's own `inputSchema` — enforced by the SDK on
  the MCP side and by `parseToolArguments` on the assistant side, which likewise
  **strips unknown keys rather than forwarding them**. Both were not always in
  place; see the note in §3.1.
- **Participant-name injection defense (deterministic).** A convincing name can
  fool the model into reporting a high-stakes rule as *host-stated*; so a guard
  reads the participant names **directly** (not the model's `source` tag) and drops
  any high-stakes rule (`format|scoring`) a name tries to dictate,
  replacing it with a clarification — surgical, leaving genuinely host-stated rules
  intact ([participant-text-injection.ts:51](../packages/api/src/drafts/extraction/participant-text-injection.ts),
  applied at [proposed-draft-guard.ts:129](../packages/api/src/drafts/extraction/proposed-draft-guard.ts)).
- **XSS**: React auto-escapes; no `dangerouslySetInnerHTML` in the app.
- **Internationalization is not an injection surface.** Translations (EN/ES) are
  **static application assets** authored in-repo (`packages/*/src/i18n/locales/`),
  never user- or model-supplied, and are rendered through React (escaped) — not as
  HTML. Only interface *chrome* is translated; API/assistant/participant text is
  passed through as data and never interpolated into a translation lookup key. The
  i18next `escapeValue:false` setting is safe precisely because React, not i18next,
  does the escaping ([i18n.ts](../packages/ui/src/i18n.ts)).

**Residual risk:** no least-privilege DB user — `node:sqlite` is a single-file
embedded DB with no user/role layer (architectural, acceptable for v1).

### 3.6 Insecure Design — A04

- **Destructive actions require confirmation across three layers**, all bound to an
  **action-specific HMAC** ([confirmation-token.ts:29](../packages/mcp/src/confirmation-token.ts),
  HMAC-SHA256 over `toolName + canonical args`, timing-safe compared): (1) the MCP
  server refuses to dispatch a `destructive` tool without a valid server-issued
  token ([mcp-server.ts:36](../packages/mcp/src/mcp-server.ts)); (2) the in-app
  assistant surfaces a focus-trapped confirmation card and only the confirm path
  runs the action, stamping `x-tapas-confirmation: host`
  ([assistant-routes.ts:60](../packages/api/src/http/assistant-routes.ts)); (3) the
  API records whether the action was host-confirmed in the audit log
  ([contest-routes.ts:43](../packages/api/src/http/contest-routes.ts)). A token for
  contest A cannot confirm an action on contest B (action-bound).
- **Rate limiting**: sensitive routes (login, join-by-code) limited to **5/min**,
  env-tunable and fail-closed (min 1)
  ([rate-limit.ts:13](../packages/api/src/http/rate-limit.ts)); global default
  1000/min.

**Residual risk:** confirmation tokens are **replayable for the same action** until
the state changes — a single-use nonce store is deliberately deferred
([confirmation-token.ts:16](../packages/mcp/src/confirmation-token.ts)). Low impact
(the action is idempotent-ish and still ownership-checked), noted for 6.11.

### 3.7 Authentication Failures — A07

- **Password policy**: min **12** chars with upper, lower, number, symbol
  ([password-policy.ts:9](../packages/domain/src/auth/password-policy.ts)).
- **Account lockout**: **5 failed attempts → 15-minute lock**
  ([host-account.ts:1](../packages/domain/src/auth/host-account.ts),
  wired in [authenticate-host.ts:40](../packages/api/src/auth/use-cases/authenticate-host.ts));
  the route returns **423 Locked**.
- **Refresh-token rotation**: presenting a refresh token revokes its `jti` and
  issues a fresh session
  ([refresh-session.ts:22](../packages/api/src/auth/use-cases/refresh-session.ts)).
- **Revocation**: a server-side active-session store is checked on every request
  ([require-host-session.ts:53](../packages/api/src/http/require-host-session.ts));
  sign-out revokes the `jti`.
- **No user enumeration**: unknown email and wrong password return the identical
  `Invalid email or password.`
  ([authenticate-host.ts:19](../packages/api/src/auth/use-cases/authenticate-host.ts));
  the distinguishing reason is written only to the security log.

### 3.8 Software or Data Integrity Failures — A08

- **Destructive-operation integrity**: the action-bound HMAC (§3.6) guarantees a
  destructive action was explicitly authorized for exactly those arguments —
  a tampered or replayed-across-actions token is rejected.
- **Untrusted-output integrity**: the two-phase validation (§3.5) means the
  authoritative shape of a contest never comes from the model — the API re-derives
  it.
- **Dependency integrity**: committed lockfile + `npm ci` (exact installs) + the
  audit gate (§3.3).

**Residual risk / gap:** the audit log is an append-only event projection but is
**not cryptographically signed or hash-chained** — a DB-level compromise could
edit history undetectably. Out of scope for v1; noted.

### 3.9 Security Logging & Alerting Failures — A09

- **Security-event log**: `sign_in.succeeded` / `sign_in.refused` (with reason) /
  `pat.issued` / `pat.used`, each with **actor + source IP + timestamp**
  ([security-event.ts](../packages/api/src/security/security-event.ts), recorded at
  [auth-routes.ts:51](../packages/api/src/http/auth-routes.ts) and
  [require-host-session.ts:44](../packages/api/src/http/require-host-session.ts)).
  The event type comment states it never carries a password or full token.
- **Unified audit log**: domain actions (draft saved, published, closed, revealed)
  are projected to one audit trail with actor and host-confirmation status,
  browsable per contest (5B.7).
- **No secrets in logs**: security events exclude credentials; env validation
  reports keys/reasons, never values.

**Residual risk / gap:** **there is no alerting.** Events are recorded but nothing
watches them — the design's "alert on >N failed logins" is unbuilt. Also,
destructive-tool calls are audited as *domain* events (actor + confirmation) but
**without source IP** and outside the security-event stream. Tracked for 6.11.

#### The one place the audit log is reduced: deleting a contest

The audit log is append-only everywhere except one operation, and the exception is
deliberate. `DeleteContest`
([delete-contest.ts](../packages/api/src/contests/use-cases/delete-contest.ts))
**erases a contest's audit entries** and writes a single `contest.deleted`
tombstone in their place. Anyone finding a `DELETE FROM audit_log` should read
this before assuming it is a bug.

**Why.** The log stores participant names *inside* recorded draft content —
`draft.saved` keeps the whole `DraftContent`, and the retired `DiscardDraft`
recorded `before: content`, so discarding a draft used to *copy* every
participant's name into the log at the moment of discarding it. A delete that
spared the log would therefore erase nothing that identifies anyone: the product
would say "deleted" and be wrong. A host acting on their own contest's personal
data is exactly the case where erasure is the point, so between a complete trail
and a real deletion, the deletion wins here.

**What survives.** Actor, timestamp, source path, and `confirmation` — that a
destructive act happened, by whom, when, and that it was confirmed. This is the
accountability A09 actually asks for. What does **not** survive is the payload:
the tombstone carries no `before`/`after`, asserted by test (no participant or
dish name appears anywhere in the row).

**How narrow the exception is.** The erasure is reachable only through
`AuditRecorder.deleteByContest`, whose only caller is `DeleteContest`, which
requires (a) a signed-in host, (b) ownership of that contest, and (c) — once
anyone has claimed a place or cast a vote — the contest's exact name on the
request. It runs in one transaction with the destruction it records.

**Known limitations, stated rather than discovered later:**

- **The tombstone has no reader inside the product.** Deleting removes the row
  that held `host_id`, so the audit route can no longer authorize anyone against
  that contest — the former owner gets a 404 like everyone else. The record is an
  operator/forensic artifact in the database, not a screen. (Participants are
  answered `410 Gone` instead, since a voter token already proves prior
  association with that contest — see
  [refuse-deleted-contest.ts](../packages/api/src/http/refuse-deleted-contest.ts).)
- **The confirmation token is replayable.** `confirmation-token.ts` documents it:
  a deterministic HMAC over tool and arguments, with no nonce store, so a token
  for `delete_contest(X)` always validates. The blast radius is bounded by the
  target already being gone — a replay hits `CONTEST_NOT_FOUND` — so this
  destructive action is not *repeatable*. True single-use remains future
  hardening.
- **Deletion is not itself alerted on**, sharing the gap above: it is a domain
  event with actor and confirmation, but carries no source IP and is outside the
  security-event stream.

### 3.10 Mishandling of Exceptional Conditions — *new in 2025*

- **Fail-fast on bad config**: the process refuses to start on invalid env rather
  than running half-configured (§3.2).
- **Fail-secure error handling**: unexpected errors become a generic message with
  no internal detail leaked to the client (§3.2); the rate limiter fails closed
  (min 1) even on a misconfigured env; the CI audit gate fails closed on a missing
  metric/parse error.
- **Explicit, typed error paths**: the domain returns typed errors (e.g.
  `CompileError`, `INVALID_CREDENTIALS`, `INCOMPLETE_DRAFT`) rather than throwing
  raw, so exceptional states are handled deliberately and surfaced with host-facing
  reasons.

---

## 4. What Tapas does **not** defend against (and why)

An honest threat model names its gaps. These are real — several are design promises
the code does not yet keep — prioritized for the 6.11 security pass.

| # | Gap | Risk | Why it exists / disposition |
|---|---|---|---|
| G1 | ~~`ASSISTANT_CONFIRMATION_SECRET` has a committed default~~ — **FIXED (6.11)** | ~~High~~ | The API now **refuses to boot in production** if this (or `JWT_SECRET`) is a committed dev default ([env.ts superRefine](../packages/api/src/config/env.ts)); dev/test keep the convenience default. |
| G2 | ~~`JWT_SECRET` has no length floor~~ — **FIXED (6.11)** | ~~High~~ | Now `min(32, …)` ([env.ts](../packages/api/src/config/env.ts)); examples/compose bumped; `.env*.example` document 64+ random for prod. |
| G3 | ~~**No `admin` role / role middleware**~~ — **CLOSED** | ~~Medium~~ | Administrative work is a guarded category ([require-administrator.ts](../packages/api/src/http/require-administrator.ts)): the role is read from the account store rather than the session (a refresh carries the old role claim forward, so a demotion would otherwise never take effect), and a personal access token is refused administrative work whoever issued it. The role is now *assigned* by a real path too — a deployment names its administrator in `ADMIN_BOOTSTRAP_EMAIL` and only that address can claim it, with a unique index capping administrators at one. |
| G10 | **A lost sole administrator locks the deployment** | Low today — single operator, one deployment | Deliberate consequence of closing G3, and **sharper since open registration was removed**: until then `POST /auth/register` still made *an* account — not an administrator, but a way in. Now every account comes from an invitation and the first from claiming, so a deployment whose administrator is lost is reachable only through its database. The setup route does not reopen, and nothing transfers the role. **Accepted for v1** — recorded so it is known rather than discovered. A transfer path is the natural follow-up. |
| G4 | **No anomaly alerting** on failed logins / security events | Medium — brute-force is *slowed* (lockout + rate limit) and *logged*, but nothing pages a human | Alerting infra out of scope for v1; events are captured so alerting can be added later. **Deferred.** |
| G5 | ~~No Dependabot~~ — **FIXED (6.11)** | ~~Medium~~ | Added [.github/dependabot.yml](../.github/dependabot.yml) (weekly npm + actions, grouped); the CI `audit:ci` gate vets each bump. |
| G6 | **Contest get/close/reveal use cases have no *internal* ownership check** — route-only ([get-contest.ts:8](../packages/api/src/contests/use-cases/get-contest.ts)) | Low today — every real caller goes through the guarded route | Deliberate split; add a defense-in-depth check or a lint note so a future caller can't bypass it. |
| G7 | **Confirmation tokens are replayable for the same action** (no nonce store) | Low — action is ownership-checked and state-gated | Single-use nonce deferred ([confirmation-token.ts:16](../packages/mcp/src/confirmation-token.ts)). |
| G8 | **Audit log is not signed/hash-chained** | Low — requires DB-level compromise to exploit | Out of scope for v1. |
| G9 | **No least-privilege DB user**; **CSP/HSTS via Helmet defaults** not explicitly tuned | Low | Architectural (`node:sqlite`) / hardening polish for 6.11. |

**Explicitly out of scope** (accepted risk for a thesis demo): DDoS/volumetric
attacks, physical/host compromise, malicious insider with DB access, secrets
management beyond env vars (no vault/KMS), and formal pentest.

### The failure mode this system is actually prone to

Worth naming, because it has now produced three defects rather than one:
**two paths assumed equivalent, which agree on one concern and quietly diverge on
another.** All three shipped with a green test suite.

| # | The two paths | Agreed on | Diverged on |
|---|---|---|---|
| 1 | MCP server vs in-app assistant | authorization (both re-enter the same routes) | **input validation** — only the MCP side validated `inputSchema`, so malformed model arguments were stored (§3.1) |
| 2 | Form vs assistant | the draft is stored either way | **id assignment** — the form minted a participant id per row, `CreateDraft` did not, so assistant-authored participants were unaddressable |
| 3 | Test fixture vs real app | the component renders | **resource shape** — a flat i18n fixture resolved a key the nested app could not, so a control's accessible name was a raw key in production |

The security-relevant reading: **"it goes through the same code" is a claim about a
destination, not about a check.** Each control has to be shown to hold on each
path individually — which is precisely why this document cites `path:line` per
control rather than asserting that one path implies the other. Where practical the
paths are now made to *share the implementation* (`parseToolArguments`,
`withParticipantIds`) rather than to agree by convention, because shared code
cannot drift the way parallel code does.

It also argues for a testing rule the project now follows: **assert against the
real production wiring, not a convenient fixture.** Defects 1 and 3 both survived
their tests because the test constructed a world subtly unlike the running app.

---

## 5. Remediation status (6.11 security pass)

Worked from this threat model:

- ✅ **G1, G2 — DONE.** Secret strength is enforced: `JWT_SECRET` `min(32)`, and in
  production the API refuses to boot on any committed dev-default secret (a `superRefine`
  in [env.ts](../packages/api/src/config/env.ts)). Examples/compose bumped; unit tests
  cover the short-secret rejection, the prod-default rejection, and that dev/test keep
  working. `.env*.example` document 64+ random for production.
- ✅ **G5 — DONE.** [.github/dependabot.yml](../.github/dependabot.yml) added (weekly
  npm + GitHub-Actions updates, grouped); the CI `audit:ci` gate vets each bump.
- ✅ **G3 — CLOSED.** A deployment names its administrator in
  `ADMIN_BOOTSTRAP_EMAIL` before it starts, and refuses to boot in production
  while that is still the committed example. Only that address can claim an
  unclaimed deployment; the door shuts once it has an administrator, and a
  unique partial index caps them at one, so two simultaneous claims produce one
  administrator rather than two. What this protects against is the
  unclaimed-instance land-grab: between `docker compose up` and the operator's
  first page load the deployment already resolves and serves TLS, and without a
  pinned address whoever reached it first would become administrator. What it
  does *not* protect against is someone who knows the configured address — but
  the invitation still lands in that inbox, not theirs. Note the email
  round-trip is not what secures this: it proves only that the claimant holds
  the inbox they typed. The pin is the security; the round-trip is the
  convenience. See also **G10**.
- ⏸ **G10 — accepted for v1, and worse than it was.** Closing G3 means there is
  exactly one administrator and no way to replace them. While open registration
  existed this was softer than it sounded: anyone could still create a host
  account and have *a* way in. Removing it leaves one path to any account at
  all — the configured address, the claim screen, and a link that is mailed or
  shown — so lost administrator credentials now need database access to recover.
  A transfer path is the natural follow-up if this ever runs for anybody but its
  operator.

- ⏭ **G4, G6, G7–G9 — deferred** (source IP on destructive-action audit records; a
  defense-in-depth ownership assertion in the contest use cases; single-use nonce;
  signed audit log; explicit CSP/HSTS tuning). Each is low-risk today and tracked here.

**Pass verification (from 6.10's evidence sweep + this slice):** authorization is
ownership-checked on every host endpoint and the MCP/assistant re-enter the same path
(§3.1); parameterized SQL throughout (§3.5); secrets are never logged (§3.9); the CI
supply-chain gate is green (§3.3). The two production-secret holes that were the real
risk are now closed.
