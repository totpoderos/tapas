# syntax=docker/dockerfile:1
#
# Tapas API image.
#
# Build context is the REPO ROOT (monorepo workspaces), not this package:
#   docker build -f packages/api/Dockerfile -t tapas-api .
#
# The backend runs TypeScript directly with tsx (matching `npm start` — the repo
# has no compile step), so there is no separate build stage: the runtime just
# needs Node 24 (unflagged `node:sqlite`), the installed workspace tree, and the
# source. A single deterministic `npm ci` from the root lockfile installs every
# workspace; copying only the manifests first keeps that layer cached across
# source edits.
FROM node:24-bookworm-slim

# Tini reaps zombies and forwards signals so the container stops cleanly.
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# --- Dependency layer: manifests only, then a deterministic install ----------
# `npm ci` validates the whole workspace tree against the lockfile, so every
# workspace manifest must be present even though this image only runs the API.
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

# --- Source layer ------------------------------------------------------------
# tsx runs from source; the API also reads its SQL migrations at boot, so they
# must ship in the image (see api/src/db/migrate.ts DEFAULT_MIGRATIONS_DIR).
COPY packages/shared packages/shared
COPY packages/domain packages/domain
COPY packages/mcp    packages/mcp
COPY packages/api    packages/api

# The database lives on a mounted volume, not in the image. Own it as the
# unprivileged `node` user (baked into the base image) so the container never
# runs as root — chown BEFORE declaring VOLUME so the anonymous volume inherits
# node ownership and the sqlite file is writable.
ENV DATABASE_PATH=/data/tapas.sqlite
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node

EXPOSE 3000
ENV API_PORT=3000

# Fail-fast env validation still applies: JWT_SECRET (and, in production, the
# assistant/LLM secrets) must be injected at runtime — never baked into the image.
ENTRYPOINT ["tini", "--"]
CMD ["npm", "start", "--workspace", "@tapas/api"]
