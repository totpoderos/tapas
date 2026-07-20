-- 0009_roster.sql
-- Slice D pre-slice: roster + claim. Supersedes the C3a `persons` table, which
-- stored a joined voter (random id + free-text name) with no link to the
-- compiled constraint view. A person now *claims* a place the host listed at
-- publish, keyed by the participant id the compiler already uses — so a claimed
-- place maps straight onto the scoring rules.

DROP TABLE persons;

CREATE TABLE persons (
  contest_id     TEXT NOT NULL,
  participant_id TEXT NOT NULL,   -- the id from the draft's participants, used by the materialized view
  display_name   TEXT NOT NULL,
  claimed_at     TEXT,            -- ISO timestamp when claimed, or NULL while the place is open
  PRIMARY KEY (contest_id, participant_id)
);

CREATE INDEX idx_persons_contest_id ON persons (contest_id);
