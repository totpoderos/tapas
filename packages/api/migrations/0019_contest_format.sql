-- 0019_contest_format.sql
-- A contest has one format, not an attribution and an anti-bias rule.
--
-- The two columns 0017 and 0018 added were two halves of one question, and
-- between them they could describe six contests of which three exist. `format`
-- replaces both: 'solo', 'solo_with_partners', 'couples'. Every value is a
-- contest somebody holds, so no screen above has to explain a combination that
-- does nothing.
--
-- DESTRUCTIVE AND IRREVERSIBLE. Both columns are dropped and nothing is mapped
-- across: a contest's format is not recoverable from what it recorded, because
-- the old 'arbitrary_pairs' rule has no image in the new type and inventing one
-- silently is worse than not running. This is deliberate — the change was made
-- with nothing stored worth preserving. Against a database with rows, the
-- rollback is restore-from-backup, not a down-migration.
--
-- Nullable, no default, not backfilled — the same shape as the two it replaces,
-- and for the same reason. NULL means "this contest does not say", which the
-- control room already has to handle. It is not a placeholder for 'solo':
-- guessing would turn "unknown" into a claim, and 'solo' is itself a rule. That
-- a format must be present is enforced at publish by the compiler, which is the
-- only place that can also check it against the roster.
ALTER TABLE contests DROP COLUMN attribution;
ALTER TABLE contests DROP COLUMN anti_bias;
ALTER TABLE contests ADD COLUMN format TEXT;
