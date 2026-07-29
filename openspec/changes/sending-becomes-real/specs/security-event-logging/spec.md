## ADDED Requirements

### Requirement: A message that could not be sent is recorded
The security log SHALL record an invitation whose message could not be handed
off, stamped with the source it came from. Somebody is holding a live
invitation that never reached them, and mail failing quietly for long enough
that nobody notices is how an enrollment path stops working without anyone
being told.

#### Scenario: A failed handoff is recorded
- **WHEN** an administrator invites someone and the message cannot be handed off
- **THEN** the security log records that the message did not go out

#### Scenario: A successful handoff is not noise in the log
- **WHEN** an administrator invites someone and the message is handed off
- **THEN** no failed-message entry is recorded

#### Scenario: The record never contains the link
- **WHEN** an administrator invites someone and the message cannot be handed off
- **THEN** no security log entry contains that invitation's link
