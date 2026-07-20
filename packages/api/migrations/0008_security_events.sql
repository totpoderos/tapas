-- 0008_security_events.sql
-- Slice C3c-iii: security-event logging (OWASP A09, design.md §11B.7). A
-- forensic record of authentication activity — distinct from audit_log, which
-- is a projection of contest-scoped domain events. These carry request context
-- (source IP, outcome) the domain never sees, and may have no known actor
-- (e.g. a sign-in attempt for an unregistered email). Never stores a password
-- or a full token.

CREATE TABLE security_events (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,     -- e.g. sign_in.succeeded, sign_in.refused, pat.issued, pat.used
  actor_id     TEXT,              -- host id when known, else NULL
  source_ip    TEXT NOT NULL,
  reason       TEXT,              -- refusal reason (unknown_account | bad_password | account_locked), else NULL
  occurred_at  TEXT NOT NULL
);

CREATE INDEX idx_security_events_actor ON security_events (actor_id);
CREATE INDEX idx_security_events_type ON security_events (type);
