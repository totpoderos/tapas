-- 0014_invitation_endings.sql
-- Slice B3: the two endings an administrator can cause. Unlike expiry — which
-- is a question about the clock and so is computed, never stored — revoking and
-- superseding are events, with a moment and someone who did them, so they are
-- recorded.
--
-- `superseded_by` names the invitation that replaced this one, which is what
-- lets a listing show a chain rather than a mysteriously dead record. Each
-- resend points at a strictly newer invitation, so the chain cannot loop.

ALTER TABLE host_invitations ADD COLUMN revoked_at TEXT;
ALTER TABLE host_invitations ADD COLUMN superseded_by TEXT;
