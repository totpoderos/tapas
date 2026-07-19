-- 0006_persons.sql
-- Slice C3a: voter join. A person who has joined a contest — no account,
-- just a display name scoped to that one contest.

CREATE TABLE persons (
  id            TEXT PRIMARY KEY,
  contest_id    TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE INDEX idx_persons_contest_id ON persons (contest_id);
