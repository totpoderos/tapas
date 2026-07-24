# Infrastructure generation artifact

Phase 6 asks us to **AI-generate the deployment infrastructure and document the
prompt, the output, and the verification** (tasks 6.1–6.5). Generating infra with
an assistant is itself part of the thesis: the point is not just that Docker
files exist, but that we can show *how* they were produced, *what* was generated,
and *how we proved it works*. This file is that running record. It grows one
section per infra slice.

---

## 6.1 — Dockerfiles (API, MCP, host-web, participant-web)

### The task / effective prompt

> Generate a production Dockerfile for each deployable in the Tapas monorepo —
> the API, the MCP server, and the two frontends (host-web, participant-web).
> Honour the repo's existing tooling (npm workspaces, Node ≥24, TypeScript run
> directly via `tsx`, Vite for the frontends). Keep the images secure by default
> and the same-origin cookie model intact. Then verify each image builds and runs.

The assistant (Claude) inspected the repo before writing anything, to make the
images match how the project already runs rather than imposing a new toolchain:

- **npm workspaces**, packages under `packages/*`, a single root `package-lock.json`.
- **Node ≥24** is required — the API uses the built-in `node:sqlite`
  (`DatabaseSync`), which is unflagged from Node 24 (the CI comment says as much).
- **No compile step for the backend.** `@tapas/api` and `@tapas/mcp` both declare
  `"start": "tsx src/main.ts"` and every workspace's `main` points at `src/*.ts`.
  The intended production entry point is `tsx`, so the images run `tsx` — they do
  **not** introduce a `tsc` build the rest of the repo doesn't have.
- **The MCP server speaks stdio**, not HTTP — it is a subprocess of its client
  (`runStdioServer`), so its image exposes no port.
- **The frontends rely on a same-origin proxy.** `vite.config.ts` in each app
  forwards the API path prefixes to `API_PROXY_TARGET` so the httpOnly session /
  voter cookies stay first-party (no CORS, no token in JS) — the exact model the
  E2E suite exercises. The images therefore serve the built assets with
  `vite preview`, which applies that same proxy, keeping runtime behaviour
  identical to what is tested.

### The output

| File | What it produces |
| --- | --- |
| `.dockerignore` (repo root) | One shared ignore for every image (all are built from the repo root). Keeps `node_modules`, local `*.sqlite`, `.env`, `dist`, test artifacts, `.git`, docs and specs out of the build context; `npm ci` reinstalls deterministically inside the image. |
| `packages/api/Dockerfile` | Node 24 (Debian slim) + `tini`, deterministic `npm ci`, ships the SQL migrations, runs `npm start` (tsx). DB on a `/data` volume. |
| `packages/mcp/Dockerfile` | Same base; runs the stdio MCP server (`docker run -i`), no exposed port. |
| `packages/host-web/Dockerfile` | Two-stage: `vite build` → serve `dist/` with `vite preview` (same-origin proxy). |
| `packages/participant-web/Dockerfile` | Same shape as host-web, mobile-first app. |

**Key design decisions (and why):**

- **Repo-root build context.** Each Dockerfile is built with `-f
  packages/<svc>/Dockerfile .` (context = repo root) because the workspaces share
  one lockfile and symlink each other (`@tapas/domain`, `@tapas/shared`,
  `@tapas/ui`). Only the manifests are copied before `npm ci` so that layer caches
  across source edits; `npm ci` validates the whole workspace tree, so **every**
  workspace `package.json` is copied even for a single-service image.
- **`tsx` at runtime, no build stage for the backend** — matches `npm start`.
- **`vite preview` for the frontends** rather than nginx — it reuses the tested
  same-origin proxy verbatim. Re-implementing those proxy rules in a separate
  static server is a deliberate *future hardening* step (see below), not a
  correctness requirement here.
- **Security defaults:** pinned base image, `tini` as PID 1 (clean signal
  handling / zombie reaping), and every image runs as the unprivileged **`node`**
  user (uid 1000) — not root. The API `chown`s its `/data` volume to `node`
  before declaring `VOLUME` so the sqlite file is writable without root. Env is
  **fail-fast**: the API refuses to boot without `JWT_SECRET`; the MCP server
  refuses to boot without `MCP_HOST_TOKEN` and a 32+ char
  `MCP_CONFIRMATION_SECRET` — no insecure defaults baked into an image.

### Verification (build + run smoke, 2026-07-24)

Built each image (`docker build --provenance=false -f packages/<svc>/Dockerfile
-t tapas-<svc> .`) and ran it:

| Image | Build | Runtime check | Result |
| --- | --- | --- | --- |
| `tapas-api` | ✅ | boots as `node` (uid 1000); plain HTTP `/health` → **301 → https** (the production HTTPS-redirect security control is active); with `X-Forwarded-Proto: https` → **`200 {"status":"ok"}`**; migrations write `/data/tapas.sqlite` owned **node:node** | ✅ |
| `tapas-mcp` | ✅ | missing env → **exit 1** naming both required secrets (fail-fast, no insecure default); with valid env → clean boot `ready over stdio` | ✅ |
| `tapas-host-web` | ✅ | serves **`200`** with the SPA `#root` div on :4173 | ✅ |
| `tapas-participant-web` | ✅ | serves **`200`** with the SPA `#root` div on :4174 | ✅ |

Repo suite unaffected by the infra additions: **typecheck ✅, lint ✅, 924/924
vitest ✅**.

### Bugs / gotchas caught during verification

1. **`NODE_ENV=production` + `prepare: "husky"`.** A production install omits
   devDependencies, but `tsx`/`vite`/`husky` all live in devDependencies, and the
   root `prepare` script runs `husky`, which then fails (exit 127). Fix:
   `RUN HUSKY=0 npm ci --include=dev` — skip the husky git-hook setup (no `.git`
   in the image anyway) and keep the tooling the app actually runs.
2. **Frontend `tsconfig` extends the repo-root configs.** `vite build` failed
   resolving `../../tsconfig.web.json`; the builder stages now copy
   `tsconfig.base.json` + `tsconfig.web.json` before building.
3. **`/health` returning 301 is correct, not a bug.** `registerHttpsRedirect`
   forces HTTPS in production; behind a TLS-terminating proxy the app reads
   `X-Forwarded-Proto` (`trustProxy: true`) and serves `200`. The health probe in
   compose/deploy must therefore send that header (or hit the app through the
   TLS proxy).
4. **`--provenance=false` for simpler single-manifest images.** BuildKit's default
   provenance/attestation produces a manifest-list image; disabling it yields a
   plain single-manifest image that is easier to `docker inspect` and push to
   GHCR. (Correction, traced fully in slice 6.4: the "container ran as root
   despite `USER node`" confusion during 6.1/6.2 was **not** a Docker or
   containerd bug — it was **zsh applying its history word-modifiers** to an
   unbraced `-t tapas-$svc:test` / `:local`, where `$svc:t` = "tail" and `$svc:l`
   = "lowercase", mangling the tag to `tapas-apiest` / `tapas-apiocal`. The build
   was fine; the tag the shell actually passed pointed at a stale, older image, so
   `docker run` used a pre-`USER node` build. **Always brace shell tag
   interpolation — `-t "tapas-${svc}:test"` — and confirm `docker images` shows
   the expected `:tag`.** `--provenance=false` is still used, on its own merits.)

### Known tradeoffs / follow-ons

- **Image size (~0.7–0.8 GB).** The images ship the full toolchain (`tsx` for the
  backend; `vite` for `preview` on the frontends) plus devDependencies. Acceptable
  for the thesis demo. Slimming is a follow-on: compile the backend and
  `npm prune --omit=dev`, and serve the frontends from nginx (which also removes
  `vite preview`, a dev tool, from the production path — see below).
- **`vite preview` as the frontend server** keeps parity with the tested proxy but
  is not a hardened static server. The hardening path is an nginx image that
  serves `dist/` and reverse-proxies the same API prefixes; it must be
  re-verified against the first-party-cookie E2E before replacing `vite preview`.
- The **compose file (6.2)** wires these together (API + both frontends via
  `API_PROXY_TARGET`, volumes, secrets) — see the next section.

---

## 6.2 — `docker-compose.yml` (local-development stack)

### The task / effective prompt

> Generate a `docker-compose.yml` that runs the whole Tapas stack locally from the
> Phase-6.1 images: the API, both frontends wired to it, persistent data, and
> sane secret handling. It must preserve the first-party-cookie model. Then bring
> it up and verify the stack actually works end to end.

### The output

- **`docker-compose.yml`** (repo root) — services `api`, `host-web`,
  `participant-web`, and a profile-gated `mcp`; a named volume `tapas-db`.
- **`.env.example`** — documents every secret/tunable with safe dev fallbacks;
  `.env` itself stays gitignored.

**Key decisions (and why):**

- **API runs `NODE_ENV=development` here.** The session/voter cookies are always
  `Secure; SameSite=None` (browsers honour those on `http://localhost`, a secure
  context), so they work locally — but `NODE_ENV=production` *also* forces an
  HTTP→HTTPS **redirect** that would make the stack unreachable over plain http
  without a TLS-terminating proxy. Local dev therefore runs in development mode;
  the production deployment (CD, 6.4) fronts the API with TLS and flips
  `NODE_ENV=production`. This is the one deliberate dev/prod difference.
- **Frontends point `API_PROXY_TARGET` at `http://api:3000`** (the compose service
  DNS name). `vite preview` forwards the API path prefixes there, so the browser
  only ever talks to the app origin (`localhost:4173` / `:4174`) and the
  httpOnly/Secure cookies stay **first-party** — the tested model, now in compose.
- **CORS allowlist** (`HOST_WEB_ORIGIN` / `PARTICIPANT_WEB_ORIGIN`) is set to the
  two app origins.
- **`tapas-db` named volume** for the SQLite file so data survives
  `docker compose down` (cleared only with `down -v`).
- **Healthchecks use `node -e "fetch(...)"`** — the slim base has no curl/wget, and
  Node 24 ships global `fetch`. Frontends `depend_on: { api: service_healthy }`.
- **Secrets via `${VAR:-dev-default}`** substitution: `docker compose up` works out
  of the box, and a real deployment overrides via `.env`/the environment. The API
  and MCP still fail-fast on genuinely missing required secrets.
- **`mcp` is behind `profiles: [mcp]`** — it speaks stdio and is launched by an
  MCP client (`docker run -i` / `docker compose --profile mcp run --rm mcp`), not
  a service a plain `up` should start. Kept in the file so it builds with the
  stack; excluded from the default lifecycle.

### Verification (build + up + smoke, 2026-07-24)

`docker compose config` valid (services: api, host-web, participant-web — `mcp`
correctly hidden by its profile). `docker compose up --build -d`:

| Check | Result |
| --- | --- |
| all three services build, reach **healthy**, and run **non-root (uid 1000)** | ✅ |
| API direct `:3000/health` (dev mode, no redirect) | `200 {"status":"ok"}` |
| frontends serve their SPA (`:4173`, `:4174`) | `200` + `#root` |
| **proxy chain** browser→frontend→api: `:4174/health` | `{"status":"ok"}` |
| proxy reaches a protected route: `:4173/contests` unauth | `401` |
| **first-party cookie**: register (`201`) + login through `:4173/auth/*` | `200` + `Set-Cookie: access_token/refresh_token … HttpOnly; Secure; SameSite=None` on the `:4173` origin |
| **volume persistence**: `down` (keep volume) → `up` → login same host | `200` (host survived in `tapas-db`) |

Repo suite unaffected: **typecheck ✅, lint ✅, 924/924 vitest ✅**.

### Bug caught during verification

- **`vite preview` needs a writable temp dir, which broke under non-root.** Running
  the frontends as `node` (uid 1000) surfaced a real issue the earlier root-running
  smoke had masked: `vite preview` transpiles `vite.config.ts` and writes a
  transient bundled config to `node_modules/.vite-temp/` (and next to the config) —
  both copied as root, so `node` got `EACCES` and the container exited. Fix: in each
  frontend runtime stage, `mkdir -p node_modules/.vite-temp` and `chown` just that
  dir plus the small app dir to `node` — keeping the non-root guarantee without
  chowning all of `node_modules`. (Reinforces that the non-root hardening is load-
  bearing: it caught a latent write-permission bug.)

### Known tradeoffs / follow-ons

- **No TLS in the local stack** (development mode, as above). TLS termination +
  `NODE_ENV=production` is the CD/production concern (6.4). A production compose /
  deploy manifest would add a reverse proxy (Caddy/Traefik/nginx) terminating TLS
  and forwarding `X-Forwarded-Proto` so the API's HTTPS-redirect and Secure cookies
  behave as designed.
- **`LLM_BASE_URL` defaults to a host-run Ollama** (`host.docker.internal`); the
  stack runs without it, only the assistant's model calls fail lazily.
- The **CI pipeline (6.3)** runs the deterministic + eval + a11y gates — see the
  next section; **CD (6.4)** is the production/TLS story.

---

## 6.3 — CI pipeline (deterministic hard-gate + eval threshold-gate + supply-chain + a11y)

### The task / effective prompt

> Extend the hand-written Phase-0 CI skeleton into the full pipeline: build; run
> the deterministic tests as a **hard gate** (unit + acceptance + MCP contract +
> frontend + E2E — any failure blocks); run the eval sets as a **threshold gate**
> (block only when a metric drops below its committed floor) and report the
> trajectory; run `npm audit` (supply-chain gate); run `axe-core` via the E2E
> (accessibility hard gate). Document the before/after.

### Before → after (skeleton vs AI-generated)

**Before (task 0.10 skeleton)** — one job, deterministic only:

```
on: [push:main, pull_request]
job gate: checkout → setup-node 24 → npm ci → typecheck → lint → npm test
```

No E2E, no accessibility gate, no supply-chain gate, no eval gate.

**After (this slice)** — three jobs + two new triggers:

| Job | Gate | What runs | Blocks? |
| --- | --- | --- | --- |
| `gate` | hard + supply-chain | typecheck, lint, `npm test` (vitest across every workspace = unit + acceptance/Gherkin + MCP contract + both frontends), then `npm audit --audit-level=high` | yes |
| `e2e` | hard + accessibility | `playwright install --with-deps chromium` then `npm run test:e2e` — Playwright boots the API (in-memory SQLite, `ASSISTANT_STUB`) + both frontends and drives Chromium; **axe-core** gates a11y inside the specs. Uploads the Playwright report. | yes |
| `evals` | threshold | for each suite: run the eval → `eval:gate` against the committed floors; uploads the JSON reports | on regression |

New triggers: `schedule` (weekly) and `workflow_dispatch`, for the eval job.

### The output

- **`.github/workflows/ci.yml`** — the three-job pipeline above.
- **The eval threshold-gate mechanism** (new): `packages/evals/src/thresholds.ts`
  (machine-readable mirror of the two trajectory docs' committed floors/ceilings),
  `src/gate.ts` (pure `checkThresholds` + `formatGateResult`), `src/gate-cli.ts`
  (`npm run eval:gate -- --suite <s> --report <path>`), a unit test
  (`tests/unit/gate.test.ts`), and root scripts `eval:host-assistant` / `eval:gate`.
- **Supply-chain fix:** `npm audit fix` cleared the two *high* advisories in
  shipped deps — `find-my-way` (Fastify router, HTTP/2 DoS) and `fast-uri`
  (host-confusion via `fast-json-stringify`/`ajv`) — lockfile-only, no semver/API
  change. The gate now passes at `--audit-level=high` (2 moderate dev/SDK-only
  advisories remain, tracked, not gated).

**Key design decision — why evals don't run on every PR.** An eval measures a
*real model's* behaviour: non-deterministic, model-specific, and (per the
trajectory docs) a full run is ~29 live model calls taking many minutes, with
occasional timeouts. GitHub-hosted runners have no model. So the pipeline splits
responsibility: the **deterministic + a11y + supply-chain gates hard-block every
PR**, while the **eval threshold gate runs on a schedule / manual dispatch** (or
on push/PR only when a model endpoint is configured via the `LLM_BASE_URL` repo
variable). A model-less run **skips the eval job cleanly rather than faking a
pass** — an honest skip, not a green lie. The gate *mechanism* is fully in place,
unit-tested, and runnable locally (`npm run eval:creation … && npm run eval:gate
…`); the committed floors live in code + the trajectory docs so a regression has a
stable, reviewed source. This matches how real teams treat model evals — an
out-of-band track, not a per-commit blocker.

### Verification (2026-07-24)

| Check | Result |
| --- | --- |
| `gate` locally: typecheck, lint, `npm test` | ✅ **930/930 vitest** (924 + 6 new gate tests) |
| supply-chain: `npm audit --audit-level=high` after the fix | ✅ clean (highs resolved) |
| `e2e` locally: `CI=true npm run test:e2e` | ✅ **56/56 Playwright**, axe-core clean |
| eval gate CLI on a passing report (creation v2 numbers) | exit **0**, all PASS |
| eval gate CLI on a breaching report (v3 schema collapse + over-reach) | exit **1**, the two breached metrics FAIL |
| gate unit tests (pass / floor-breach / ceiling-breach / inclusive boundary / **fails-closed on missing metric**) | ✅ |
| workflow YAML parses; jobs `gate`/`e2e`/`evals`, `if:` expression, steps | ✅ |

The Fastify-router bump (from `npm audit fix`) is covered by the same 930 vitest +
56 E2E passing — no behavioural regression.

### Known tradeoffs / follow-ons

- **`npm audit` gate.** High/critical block; moderate/low don't (2 moderate remain,
  via `@modelcontextprotocol/sdk`, `--force`-only). *Updated in 6.4:* the raw
  `npm audit --audit-level=high` became `npm run audit:ci` (`scripts/audit-gate.mjs`
  + `.audit-allowlist.json`) so a genuinely-not-applicable high can be allowlisted
  with a written reason and an **expiry**, while any new/unlisted high still blocks
  — see 6.4. Dependabot (task 6.11) will track the moderates.
- **The eval job needs `secrets.LLM_BASE_URL`/`LLM_API_KEY` (+ `vars.LLM_MODEL`)**
  to run in CI — a self-hosted runner with Ollama or a hosted OpenAI-compatible
  endpoint. Until configured it only runs on demand; the weekly schedule fires but
  no-ops without the endpoint.
- **CD (6.4)** consumes the images the `gate`/`e2e` jobs validate and adds the
  production/TLS deploy — see the next section.

---

## 6.4 — CD pipeline (deploy on tag) + production/TLS

### The task / effective prompt

> Generate the CD pipeline: on a version tag, build and push the four images to a
> registry, then deploy. There is no real host, so make the deploy a verifiable
> dry-run — and resolve the production/TLS thread 6.1/6.2 left open (the API's
> HTTP→HTTPS redirect + `Secure` cookies need a TLS edge). Document and verify.

### The output

- **`.github/workflows/cd.yml`** — on `push: tags: ['v*']` (and `workflow_dispatch`):
  - **`images`** job (matrix over `api`/`mcp`/`host-web`/`participant-web`): logs
    in to **GHCR** with the built-in `GITHUB_TOKEN` (`packages: write`) and
    build-push-actions each image `--provenance=false` to
    `ghcr.io/<owner>/tapas-<svc>:<tag>` + `:latest`, with GHA build cache.
  - **`deploy`** job (dry-run): renders `docker-compose.prod.yml` against the
    just-pushed tag (`docker compose config` — fails on a malformed manifest or
    unresolvable ref) and writes a deploy summary. The only change a real target
    needs is swapping this for `ssh … docker compose up -d` on the host.
- **`docker-compose.prod.yml`** — the production manifest: **pulls** the GHCR
  images (no `build`), runs the API at `NODE_ENV=production`, and fronts
  everything with **Caddy** for automatic TLS. Required secrets use `${VAR:?}` (no
  dev fallback — a real deploy must supply them).
- **`deploy/Caddyfile`** — the TLS edge.
- **`.env.prod.example`** — the production env template (owner/tag, domains, ACME
  email, real secrets).

**The production topology (resolves the 6.1/6.2 TLS thread):**

```
Browser --HTTPS--> Caddy (one edge, terminates TLS, auto-cert)
   Caddy: API path prefixes         -> api:3000  (sets X-Forwarded-Proto: https)
   Caddy: everything else (the SPA) -> host-web:4173 / participant-web:4174
```

The key insight (from reading `https-redirect.ts`): the API redirects any request
whose `request.protocol !== 'https'`, and that reflects `X-Forwarded-Proto`
(`trustProxy: true`). So the edge **must** proxy the API directly and set
`X-Forwarded-Proto: https` — which Caddy's `reverse_proxy` does by default. This
means the frontends' own dev proxy is **bypassed in production** (Caddy owns API
routing), which also retires the "`vite preview` isn't a hardened server" caveat
for the API path. The API runs `NODE_ENV=production`, so its HTTPS redirect and
`Secure; SameSite=None` cookies are correct behind a real TLS origin, with no
redirect loop.

### Verification — local dry-run with real TLS (2026-07-24)

Built + tagged the images `:local`, set `REGISTRY_OWNER=""` (so the manifest uses
the local tags), and brought the full prod stack up with Caddy issuing an internal
cert for `localhost` / `participant.localhost`:

| Check | Result |
| --- | --- |
| `docker compose -f docker-compose.prod.yml config` (+ `--images`) | ✅ valid; resolves `ghcr.io/<owner>/tapas-*:<tag>` (or local tags) |
| all four services (caddy + api + 2 frontends) up, **api healthy** | ✅ |
| `http://localhost/health` at the edge | **308** → HTTPS (Caddy auto-redirect) |
| `https://localhost/health` via Caddy → API (**production mode**) | **`200 {"status":"ok"}`** — `X-Forwarded-Proto: https` ⇒ no redirect loop |
| `https://localhost/` (SPA) / `…/contests` unauth | `200` + `#root` / `401` |
| **Secure cookie over real TLS**: register `201` + login `200` | `Set-Cookie … HttpOnly; Secure; SameSite=None` over **HTTP/2** |
| participant app on its own domain (internal cert) | `200`; `/health` → `{"status":"ok"}` |
| `cd.yml` YAML parses; jobs `images`/`deploy`, 4-service matrix, tag trigger, `packages: write` | ✅ |

Repo suite unaffected: **typecheck ✅, lint ✅, 930/930 vitest ✅**.

### Bug/finding caught during verification

- **The 6.1/6.2 "runs as root despite `USER node`" mystery was zsh, not Docker.**
  Building with an unbraced `-t tapas-$svc:local` let **zsh apply its history word
  modifiers** (`$svc:l` = lowercase, `$svc:t` = tail), mangling the tag to
  `tapas-apiocal` / `tapas-apiest`; `docker run tapas-api:local` then used a stale
  older image. The images were always built correctly and non-root. Fix: **brace
  the interpolation** (`-t "tapas-${svc}:local"`). The 6.1 note above is corrected
  accordingly.

### Supply-chain gate hardening (the gate caught a live advisory)

While verifying, CI's `gate` job went **red on the `evals`-adjacent supply-chain
step** — not from anything in this slice, but because a **high advisory was
published mid-session**: `GHSA-qwww-vcr4-c8h2`, a **React Router RSC-mode CSRF
bypass** affecting `react-router` `7.12.0 – 8.2.0` (so our `react-router-dom
^7.18.1`). The gate did exactly its job. Resolution:

- A downgrade is a dead end — `react-router` `6.0.0 – 7.17.0` carries a *larger*
  pile of highs (XSS, RCE via vendored turbo-stream, DoS…), all fixed in `7.18.0`;
  the only fully-clean version is `8.2.1+`, a major upgrade (its own slice).
- The `^7.18.1` advisory is **RSC/framework-mode only**; both apps use
  `react-router-dom` in declarative SPA mode (`BrowserRouter` + `<Routes>`, no
  server actions, no RSC), so the path isn't reachable here.
- So the raw `npm audit --audit-level=high` became **`npm run audit:ci`**
  (`scripts/audit-gate.mjs`), backed by **`.audit-allowlist.json`** — a small,
  reviewed list of high/critical advisories that are genuinely not applicable, each
  with a **reason, advisory URL, and `expires` date**. An allowlisted advisory is
  reported as a justified exception; an **expired** entry stops suppressing (the
  gate re-blocks, forcing re-review); any **new/unlisted** high still blocks.
  Verified both ways: PASS with the entry, exit 1 with it removed. The react-router
  v8 upgrade is tracked to retire the exception.

### Known tradeoffs / follow-ons

- **The `deploy` job is a dry-run** (no host): it validates the manifest against
  the pushed tag. A real deployment replaces it with an `ssh` + `docker compose
  pull && up -d` step (host + `known_hosts`/key secrets), or a managed-host action.
- **Actually pushing to GHCR fires on a real `v*` tag** (or `workflow_dispatch`);
  it needs no extra secret (`GITHUB_TOKEN` suffices). The first push creates the
  packages under the owner; make them public if the deploy host pulls anonymously.
- **Image slimming and serving frontend `dist` directly from Caddy** (dropping
  `vite preview` from the production path entirely) remain the hardening follow-on
  from 6.1.
- **Secrets management**: the manifest takes secrets from the environment/`.env`;
  a real deploy would source them from the host's secret store (not a file on disk).
