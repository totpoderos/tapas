-- 0020_rate_limits.sql
-- How many attempts one source has made at a throttled entry point, and when
-- its window opened. In the database rather than in a process's memory so that
-- every instance of a deployment counts against the same number — five per
-- instance is not the limit the threat model claims.
--
-- One row per source per route, reset in place when its window has passed, so
-- the table holds at most what it has recently seen.

CREATE TABLE rate_limits (
  bucket            TEXT PRIMARY KEY,   -- route + source address
  count             INTEGER NOT NULL,
  window_started_at TEXT NOT NULL       -- ISO timestamp
);

CREATE INDEX idx_rate_limits_window ON rate_limits (window_started_at);
