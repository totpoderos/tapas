-- 0012_contest_close_reveal.sql
-- Slice E0: a published contest carries how it closes and reveals — dropped
-- entirely at publish until now. Backing columns for close/reveal (Slice E).

ALTER TABLE contests ADD COLUMN close_rule TEXT NOT NULL DEFAULT '{"when":"all_sent"}';
ALTER TABLE contests ADD COLUMN reveal_strategy TEXT NOT NULL DEFAULT '{"when":"host_trigger"}';
ALTER TABLE contests ADD COLUMN closed_at TEXT;
ALTER TABLE contests ADD COLUMN revealed_at TEXT;
