# syntax=docker/dockerfile:1
#
# Tapas participant web app image (mobile-first PWA target).
#
# Build context is the REPO ROOT (monorepo workspaces):
#   docker build -f packages/participant-web/Dockerfile -t tapas-participant-web .
#
# Same two-stage shape as host-web. The runtime serves the built assets with
# `vite preview`, which applies the same-origin proxy from vite.config.ts
# (/contests, /health -> API_PROXY_TARGET) so the `Secure;SameSite=None` voter
# cookie stays first-party — the model the E2E suite exercises. API_PROXY_TARGET
# is a RUNTIME setting; point it at the API when the container starts. (The PWA
# service worker + manifest are task 5C.5, not this image.)

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
COPY packages/shared          packages/shared
COPY packages/ui              packages/ui
COPY packages/participant-web packages/participant-web
RUN npm run build --workspace @tapas/participant-web

# --- Runtime -----------------------------------------------------------------
FROM node:24-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules                     node_modules
COPY --from=builder /app/package.json                     package.json
COPY --from=builder /app/packages/participant-web/dist    packages/participant-web/dist
COPY --from=builder /app/packages/participant-web/package.json packages/participant-web/package.json
COPY --from=builder /app/packages/participant-web/vite.config.ts packages/participant-web/vite.config.ts

# Serve as the unprivileged `node` user (static assets only, no writes needed).
USER node

ENV API_PROXY_TARGET=http://localhost:3000
EXPOSE 4174

ENTRYPOINT ["tini", "--"]
CMD ["npm", "run", "preview", "--workspace", "@tapas/participant-web", "--", "--host", "0.0.0.0"]
