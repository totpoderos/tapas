# Security, accessibility & operations

Full detail lives in [`docs/threat-model.md`](../../docs/threat-model.md) (OWASP
Top 10 : 2025 mapping, with `path:line` code references and honestly-recorded
gaps) and [`docs/accessibility.md`](../../docs/accessibility.md) (WCAG 2.1 AA
pass). This page is the operational map: what's enforced, where, and how to
verify it.

## Authentication & authorization model

- **Hosts** sign in with email + password (bcrypt, cost 12); sessions are
  hand-rolled HS256 JWTs in httpOnly/Secure cookies, verified and checked live
  against a `SessionStore` (so revocation is real, not just token expiry).
  Alternatively, an external caller (MCP) authenticates with a **host-issued PAT**
  (`Authorization: Bearer`) — both resolve to the same `{id, role}` shape and the
  same downstream checks (`packages/api/src/http/require-host-session.ts`).
- **Voters** authenticate per-contest (join code + display name + optional
  remember-me token), scoped to exactly one `contestId`
  (`packages/api/src/http/require-voter-session.ts`).
- **Ownership, not role, is the real check.** Every host operation additionally
  verifies `contest.hostId === request.hostSession.id` (or the draft equivalent)
  before acting — see [architecture/overview.md](../architecture/overview.md#authorization-role-is-necessary-ownership-is-what-matters).
- **Account lockout**: 5 failed attempts locks a host account for 15 minutes
  (`packages/domain/src/auth/host-account.ts`).
- **A recorded, closed gap worth knowing about**: the MCP server and the in-app
  assistant share *authorization* enforcement but once diverged on *input
  validation* — the MCP SDK validated tool arguments against each schema before
  dispatch, but the in-app assistant originally forwarded a model's arguments to
  `toRequest` unchecked, which let malformed data (e.g. `id: undefined`) reach
  the API. Closed by `parseToolArguments` in
  `packages/mcp/src/tool-catalog.ts`, now applied on both entry points. The
  general lesson — *two paths sharing a destination still have to be shown to
  share each check individually* — is worth remembering before assuming "same
  route" means "same guarantees." Full writeup: `docs/threat-model.md` §3.1 and
  §4.

## Destructive-action confirmation

Covered in depth in
[architecture/overview.md](../architecture/overview.md#destructive-actions-propose--confirm--act):
an action-bound HMAC gate enforced identically across the MCP server, the
in-app assistant, and the API's own record of who confirmed. Known residual
risk: confirmation tokens have no nonce store and are technically replayable
(bounded in practice) — see `docs/backlog.md` and `docs/threat-model.md` §3.9.

## What is *not* yet covered (read before assuming a gap is a bug)

- No alerting on security events or repeated auth failures — logged, not
  watched (`docs/threat-model.md` §3.9, `docs/backlog.md`).
- CSRF relies on `SameSite` cookies rather than a synchroniser token
  (`docs/threat-model.md`).

- **An administrator cannot be changed.** `ADMIN_BOOTSTRAP_EMAIL` is read only
  while the deployment is unclaimed; afterwards the administrator is a row, a
  unique index caps administrators at one, and nothing invites a second. Changing
  it means editing SQLite by hand (`docs/backlog.md`).

Administrative work **is** built
(`packages/api/src/http/require-administrator.ts`, `admin-routes.ts`, the
`admin-bootstrap` and `administrative-access` capabilities); G3 in
[`docs/threat-model.md`](../../docs/threat-model.md) records it CLOSED, and G10
records what closing it cost — a deployment has exactly one administrator and
nothing transfers the role. What never landed is a *generic* `requireRole()`:
`requireAdministrator` guards the one role beyond `host` and `voter`. Both
[`docs/backlog.md`](../../docs/backlog.md) and §3.1 of the threat model said
otherwise until recently, and each now records that it did — worth knowing if
you meet an older copy.
- CSP/HSTS ride Helmet's defaults rather than being explicitly hardened.
- Contest `get/close/reveal` use cases carry no *internal* ownership check —
  it lives only at the route layer; a future non-route caller would bypass it.

## Accessibility (WCAG 2.1 AA) — a hard CI gate, not a checkbox

The participant app is used live at a venue (one-handed, poor light, time
pressure) — accessibility is core UX, not compliance theater. Enforced
automatically on every PR:

| Layer | Tool | Scope |
|---|---|---|
| Component | `jest-axe` | every screen + modal-open state, both apps |
| Whole-system | `@axe-core/playwright` | every screen, mid-journey, in a real browser |
| Reflow/zoom | Playwright at 320px | score screen + reveal screen |

Both axe layers gate `ci.yml`'s E2E job — **a violation fails the build.** The
ruleset explicitly includes `wcag21a`/`wcag21aa` tags (a past gap: the E2E scans
were originally configured for WCAG 2.0 only, leaving 2.1-specific criteria like
Non-text Contrast and Reflow unchecked — see `docs/accessibility.md` §1 for the
fix and how it was caught). One item is deliberately left to a human: a real
screen-reader listening pass (TalkBack/VoiceOver/NVDA) — semantics can be
asserted automatically, but whether announcements are well-timed and not
exhausting cannot be. Tracked in `docs/backlog.md`.

## Configuration

All configuration is environment variables, Zod-validated at startup — the
process **refuses to boot** on missing/invalid config, and secrets are never
logged (`packages/api/src/config/env.ts`, `packages/mcp/src/config/env.ts`).
Secrets must be ≥ 32 characters; in production the API additionally refuses to
start if `JWT_SECRET`, `ASSISTANT_CONFIRMATION_SECRET`, `MAIL_FROM` or
`ADMIN_BOOTSTRAP_EMAIL` is left at its committed dev default. Get
`ADMIN_BOOTSTRAP_EMAIL` right before the first boot: it names who may *claim*
the deployment, is consulted only while it is unclaimed, and there is no
in-app path to change the administrator afterwards. See [`.env.example`](../../.env.example) (local) and
[`.env.prod.example`](../../.env.prod.example) (deploy) for the full variable
list and what each one controls — notably `PARTICIPANT_WEB_ORIGIN` (CORS
allowlist *and* what join links are built from) and the `LLM_*` /
`MCP_HOST_TOKEN` variables for the AI surfaces
([integrations/ai-surfaces.md](../integrations/ai-surfaces.md)). Do not read or
copy live secret values from `.env` (gitignored) — `.env.example` and
`.env.prod.example` hold placeholders only.

## CI/CD

**`ci.yml` is currently disabled** (`disabled_manually`, to save Actions quota),
so none of the gates below run on a PR today — the local commands are the only
gate, and they have to be run by hand. Re-enabling it is the intent; until then,
do not read a green PR as a passing build.

`ci.yml` runs three gates on every PR:

1. **Hard gate** — typecheck, lint, full test suite, supply-chain audit
   (`npm run audit:ci`, blocking on high/critical advisories not covered by a
   justified, expiring entry in [`.audit-allowlist.json`](../../.audit-allowlist.json)),
   and the infra eval (static mode, ≥ 85%).
2. **Accessibility hard gate** — axe-core inside the Playwright E2E.
3. **Threshold gate** — the eval suites (see
   [integrations/ai-surfaces.md](../integrations/ai-surfaces.md)); runs on
   schedule/dispatch since hosted runners have no model, and **skips cleanly**
   rather than faking a pass.

`cd.yml` builds and pushes the four service images (api, mcp, host-web,
participant-web) to GHCR on a `v*` tag, then validates the production compose
manifest ([`docker-compose.prod.yml`](../../docker-compose.prod.yml)) — there is
no real deploy target for this thesis project, so the CD "deploy" step is a
dry-run manifest render; swapping in a real `ssh`/`compose up` step is the only
change a real deployment target would need. Production is fronted by
[Caddy](../../deploy/Caddyfile) for automatic TLS.

## Local development & running the stack

Pointers only — see the root [`README.md`](../../README.md) for exact commands:
`npm run dev` (API `:3000`, host app `:5173`, participant app `:5174`, reading
`.env` automatically via `node --env-file`); `docker compose up --build` for the
full containerized stack; the MCP server is launched separately
(`npm run dev:mcp`) since it speaks stdio to an MCP client rather than serving
HTTP.
