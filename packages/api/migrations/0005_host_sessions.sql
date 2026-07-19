-- 0005_host_sessions.sql
-- Slice C2: HTTP sessions. Tracks the active refresh session behind each
-- issued token pair (shared `jti`), so logout and refresh rotation can
-- actually revoke a session rather than waiting out the token's TTL.

CREATE TABLE host_sessions (
  jti         TEXT PRIMARY KEY,
  host_id     TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT
);

CREATE INDEX idx_host_sessions_host_id ON host_sessions (host_id);
