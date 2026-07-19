-- 0007_host_pats.sql
-- Slice C3b: host personal access tokens. A bearer credential a host issues
-- for an external client (e.g. the MCP server) to act as them. Only the hash
-- is stored — the raw token is shown once, at issuance.

CREATE TABLE host_pats (
  id          TEXT PRIMARY KEY,
  host_id     TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  revoked_at  TEXT
);

CREATE UNIQUE INDEX idx_host_pats_token_hash ON host_pats (token_hash);
CREATE INDEX idx_host_pats_host_id ON host_pats (host_id);
