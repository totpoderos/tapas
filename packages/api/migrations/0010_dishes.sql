-- 0010_dishes.sql
-- Slice D1: dish submission. A cook registers the dish they brought against
-- their pre-materialized dish slot (the compiler fixed the slots + submitters
-- at publish; this adds the presentation). Keyed by (contest_id, dish_id) —
-- dish ids like "D-ana" are unique only within a contest.

CREATE TABLE dishes (
  contest_id    TEXT NOT NULL,
  dish_id       TEXT NOT NULL,      -- the materialized dish slot id (e.g. D-ana, D-ana-marcos)
  display_name  TEXT NOT NULL,
  description   TEXT,               -- optional
  submitter_ids TEXT NOT NULL,      -- JSON array of participant ids (one, or two for a couple)
  submitted_at  TEXT NOT NULL,
  PRIMARY KEY (contest_id, dish_id)
);

CREATE INDEX idx_dishes_contest_id ON dishes (contest_id);
