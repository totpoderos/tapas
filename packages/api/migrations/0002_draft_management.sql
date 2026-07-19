-- 0002_draft_management.sql
-- Slice A: managing a contest draft (form path). Other tables (contests,
-- persons, dishes, vote_sessions, scores) arrive with their slices.
-- Postgres-ready: TEXT columns hold JSON; no SQLite-only constructs.

CREATE TABLE contest_drafts (
  id         TEXT PRIMARY KEY,
  host_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  content    TEXT NOT NULL,                 -- JSON: the full DraftContent
  status     TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_contest_drafts_host ON contest_drafts (host_id);

-- The audit log is a projection of domain events (design.md §5).
CREATE TABLE audit_log (
  id           TEXT PRIMARY KEY,
  contest_id   TEXT NOT NULL,               -- the draft/contest subject id
  actor_id     TEXT NOT NULL,
  type         TEXT NOT NULL,               -- e.g. draft.saved
  before_json  TEXT,                        -- JSON or NULL
  after_json   TEXT,                        -- JSON or NULL
  source_path  TEXT NOT NULL,               -- form | mcp | system
  tool_name    TEXT,
  tool_args    TEXT,                        -- JSON or NULL
  confirmation TEXT,                        -- host | auto | NULL
  occurred_at  TEXT NOT NULL
);

CREATE INDEX idx_audit_log_contest ON audit_log (contest_id);
