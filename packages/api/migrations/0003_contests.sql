-- 0003_contests.sql
-- Slice B: publishing a contest. A published contest carries the same id as
-- the draft it came from, plus the compiled materialized view and a join code.

CREATE TABLE contests (
  id           TEXT PRIMARY KEY,
  host_id      TEXT NOT NULL,
  name         TEXT NOT NULL,
  join_code    TEXT NOT NULL,
  status       TEXT NOT NULL,
  materialized TEXT NOT NULL,          -- JSON: the compiled constraint view
  created_at   TEXT NOT NULL
);

CREATE INDEX idx_contests_host ON contests (host_id);
CREATE UNIQUE INDEX idx_contests_join_code ON contests (join_code);
