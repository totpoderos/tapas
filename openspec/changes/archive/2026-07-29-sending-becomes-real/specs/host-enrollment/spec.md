## ADDED Requirements

### Requirement: A message that cannot be sent does not lose the invitation
An invitation SHALL stand even when its message cannot be handed off, and the
administrator SHALL be told that it did not go out and given the invitation's
identity so they can act on it. Failing to reach a mail server SHALL NOT read as
failing to invite — the invitation is stored before anything is sent precisely
so that the two can be told apart.

#### Scenario: The invitation survives a message that could not be sent
- **WHEN** an administrator invites someone and the message cannot be handed off
- **THEN** the invitation exists and is pending
- **AND** the administrator is told the message did not go out

#### Scenario: The invited person can still accept
- **WHEN** an administrator invites someone, the message cannot be handed off, and the invited person is given their link by other means
- **THEN** they can accept and become a host

#### Scenario: Inviting is not reported as having failed
- **WHEN** an administrator invites someone and the message cannot be handed off
- **THEN** inviting is not refused

### Requirement: The link is offered once when the message could not be sent
The link SHALL be offered to the administrator when, and only when, its message
could not be handed off — in that answer alone, and never stored. The raw token
exists only in the request that created it, and keeping it so it could be shown
again would make the stored invitation enough to accept with, which it must
never be.

#### Scenario: A failed handoff offers the link
- **WHEN** an administrator invites someone and the message cannot be handed off
- **THEN** the link is offered to that administrator

#### Scenario: A successful handoff offers no link
- **WHEN** an administrator invites someone and the message is handed off
- **THEN** no link is offered to that administrator

#### Scenario: The link is still absent from the stored invitation
- **WHEN** an administrator invites someone and the message cannot be handed off
- **THEN** the stored invitation does not contain the link

### Requirement: An invitation records whether its message was handed off
An invitation SHALL record whether its message was handed off to a mail server,
and SHALL NOT claim that it was delivered. A mail server accepting a message is
all this system can observe; whether it reached anyone is decided later, by
parties it never hears from.

#### Scenario: A handed-off message is recorded as such
- **WHEN** an administrator invites someone and the message is handed off
- **THEN** the invitation records that its message went out

#### Scenario: A message that could not be handed off is recorded as such
- **WHEN** an administrator invites someone and the message cannot be handed off
- **THEN** the invitation records that its message did not go out

#### Scenario: Resending records the new message's own outcome
- **WHEN** an administrator resends an invitation whose original message could not be handed off, and the new message is handed off
- **THEN** the new invitation records that its message went out

## MODIFIED Requirements

### Requirement: The invited person is sent a link
Inviting SHALL send a message to the invited address, and only to that address,
carrying a link that identifies the invitation. The invitation as stored SHALL
NOT reveal the link, whether or not the message was ever sent, so that reading
the stored record confers no ability to accept.

#### Scenario: A message is sent to the invited address
- **WHEN** an administrator invites "nuevo@example.com"
- **THEN** a message is sent to "nuevo@example.com"
- **AND** it carries a link for that invitation

#### Scenario: The stored invitation does not reveal the link
- **WHEN** an administrator invites "nuevo@example.com"
- **THEN** the stored invitation does not contain the link
