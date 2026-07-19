-- 0004_host_accounts.sql
-- Slice C1: host authentication. Credentials live here, separate from
-- participant identity (`persons`, which arrives with the join flow).

CREATE TABLE host_accounts (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'host',
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until   TEXT,                          -- ISO timestamp or NULL
  created_at     TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_host_accounts_email ON host_accounts (email);
