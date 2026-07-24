# syntax=docker/dockerfile:1
#
# Tapas MCP server image.
#
# Build context is the REPO ROOT (monorepo workspaces):
#   docker build -f packages/mcp/Dockerfile -t tapas-mcp .
#
# The MCP server speaks the Model Context Protocol over STDIO — it is a
# subprocess of its client, not a network service, so it exposes no port and
# publishes nothing on stdout except the protocol. An MCP client launches it,
# e.g.:
#   docker run -i --rm \
#     -e API_BASE_URL=http://api:3000 \
#     -e MCP_HOST_TOKEN=<host PAT> \
#     -e MCP_CONFIRMATION_SECRET=<32+ char secret> \
#     tapas-mcp
# The `-i` (keep STDIN open) is required — without it the stdio transport has no
# channel. Like the API, it runs TypeScript directly via tsx (no compile step).
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# --- Dependency layer: manifests only, then a deterministic install ----------
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
# The MCP server's dev dependency on @tapas/api is build/test-only; at runtime
# it only calls the API over HTTP (API_BASE_URL), so the api source is not copied.
COPY packages/shared packages/shared
COPY packages/mcp    packages/mcp

# Drop to the unprivileged `node` user baked into the base image — the server
# needs no root and no writable filesystem.
USER node

# Fail-fast env validation refuses to boot without MCP_HOST_TOKEN and a 32+ char
# MCP_CONFIRMATION_SECRET — no insecure defaults. Inject them at runtime.
ENTRYPOINT ["tini", "--"]
CMD ["npm", "start", "--workspace", "@tapas/mcp"]
