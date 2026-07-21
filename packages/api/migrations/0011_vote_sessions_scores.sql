-- 0011_vote_sessions_scores.sql
-- Slice D2: scoring. A voter has one vote session per contest (draft → sent);
-- it contains their scores, one per (dish, category). The UNIQUE constraints
-- are load-bearing correctness (design.md §11A): a mocked repo would let a
-- duplicate score through, real SQLite catches it.

CREATE TABLE vote_sessions (
  id           TEXT PRIMARY KEY,
  contest_id   TEXT NOT NULL,
  voter_id     TEXT NOT NULL,        -- the participant id (the compiled view's identity)
  status       TEXT NOT NULL,        -- draft | sent
  created_at   TEXT NOT NULL,
  submitted_at TEXT,                 -- set when the vote is sent
  UNIQUE (contest_id, voter_id)
);

CREATE TABLE scores (
  id              TEXT PRIMARY KEY,
  vote_session_id TEXT NOT NULL,
  dish_id         TEXT NOT NULL,
  category_id     TEXT NOT NULL,
  value           INTEGER NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE (vote_session_id, dish_id, category_id)
);

CREATE INDEX idx_scores_session ON scores (vote_session_id);
