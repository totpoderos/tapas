-- 0015_first_administrator.sql
-- Slice D: a deployment gets its first and only administrator.
--
-- An account's role now comes from the invitation that created it. Every
-- existing invitation was for an ordinary host, which is the default, so no
-- existing row changes meaning.
ALTER TABLE host_invitations ADD COLUMN invited_role TEXT NOT NULL DEFAULT 'host';

-- At most one administrator, guaranteed by the database rather than by a check
-- that a second request could interleave with: two simultaneous claims produce
-- one administrator and one failed write.
--
-- This also encodes the redesign's "one administrator" decision as a constraint
-- rather than a convention. A later change wanting several must drop this
-- index deliberately, which is the right way round.
--
-- Safe to add to any existing database: no deployment has ever held an
-- administrator, so it cannot conflict.
CREATE UNIQUE INDEX idx_one_administrator ON host_accounts (role) WHERE role = 'admin';
