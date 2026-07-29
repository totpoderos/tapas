-- 0013_host_invitations.sql
-- Slice B1: an administrator invites an address, and the person holding that
-- inbox becomes a host by opening the link and choosing a password. Only the
-- hash of the token is stored — the raw token exists in the sent message and
-- nowhere else, so reading this table confers no ability to accept.
--
-- `issued_at` is written from the start although nothing reads it yet: the
-- expiry rule arrives in the next slice, and it should be a behavior change
-- rather than a migration.

CREATE TABLE host_invitations (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL,
  token_hash   TEXT NOT NULL,
  -- 'pending' | 'accepted'. Expired and revoked join them in later slices.
  status       TEXT NOT NULL,
  issued_by    TEXT NOT NULL,
  issued_at    TEXT NOT NULL,
  accepted_at  TEXT
);

CREATE UNIQUE INDEX idx_host_invitations_token_hash ON host_invitations (token_hash);
CREATE INDEX idx_host_invitations_email ON host_invitations (email);
