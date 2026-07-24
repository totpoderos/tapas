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
4. **Build reproducibility under Docker Desktop's containerd image store.** Use
   `--provenance=false` so each build is a single-manifest image (BuildKit's
   default attestation/provenance manifest-list confused `docker inspect
   .Config.User` and, in one run, left a stale tag so an old pre-`USER node`
   image was still running as root). Always confirm `docker images` shows the
   expected `:tag` and that the container runs as `node` after building. This flag
   is carried into the CI build step (6.3).

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
  `API_PROXY_TARGET`, a TLS-terminating front, volumes, secrets) and is the next
  slice.
