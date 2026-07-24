# syntax=docker/dockerfile:1
#
# Tapas host/admin web app image.
#
# Build context is the REPO ROOT (monorepo workspaces):
#   docker build -f packages/host-web/Dockerfile -t tapas-host-web .
#
# Two stages. The builder installs the workspace and runs `vite build` to emit
# static assets. The runtime serves them with `vite preview`, which also applies
# the same-origin proxy from vite.config.ts (/auth, /drafts, /contests,
# /assistant -> API_PROXY_TARGET). That proxy is load-bearing: it keeps the
# httpOnly session cookie first-party (no CORS, no token in JS) — the exact model
# the E2E suite exercises. Re-implementing it in a separate static server (nginx)
# is a deliberate future hardening step; here we keep behaviour identical to what
# is tested. API_PROXY_TARGET is a RUNTIME setting (the built assets are
# backend-agnostic), so point it at the API when the container starts.

# --- Builder -----------------------------------------------------------------
FROM node:24-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json      packages/shared/
COPY packages/domain/package.json      packages/domain/
COPY packages/ui/package.json          packages/ui/
COPY packages/api/package.json         packages/api/
COPY packages/mcp/package.json         packages/mcp/
COPY packages/host-web/package.json    packages/host-web/
COPY packages/participant-web/package.json packages/participant-web/
COPY packages/evals/package.json       packages/evals/
RUN HUSKY=0 npm ci --include=dev

# The app's tsconfig extends the shared root configs (tsconfig.web ->
# tsconfig.base); vite resolves them during the build, so they must be present.
COPY tsconfig.base.json tsconfig.web.json ./
COPY packages/shared   packages/shared
COPY packages/ui       packages/ui
COPY packages/host-web packages/host-web
RUN npm run build --workspace @tapas/host-web

# --- Runtime -----------------------------------------------------------------
FROM node:24-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

# Bring the installed toolchain and the built app across (vite preview needs the
# vite binary and the app's dist/ + config).
COPY --from=builder /app/node_modules              node_modules
COPY --from=builder /app/package.json              package.json
COPY --from=builder /app/packages/host-web/dist    packages/host-web/dist
COPY --from=builder /app/packages/host-web/package.json packages/host-web/package.json
COPY --from=builder /app/packages/host-web/vite.config.ts packages/host-web/vite.config.ts

# `vite preview` transpiles vite.config.ts and writes a transient bundled config
# under node_modules/.vite-temp (and next to the config), so both must be
# writable by the runtime user. Own just those dirs (not all of node_modules) so
# we can still drop root.
RUN mkdir -p node_modules/.vite-temp \
  && chown node:node node_modules/.vite-temp \
  && chown -R node:node packages/host-web

# Serve as the unprivileged `node` user.
USER node

# The API the same-origin proxy forwards to (overridden in compose/deploy).
ENV API_PROXY_TARGET=http://localhost:3000
EXPOSE 4173

ENTRYPOINT ["tini", "--"]
CMD ["npm", "run", "preview", "--workspace", "@tapas/host-web", "--", "--host", "0.0.0.0"]
