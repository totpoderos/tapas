## ADDED Requirements

### Requirement: An administrator sees one list of people
An administrator SHALL see the people in their deployment as one list keyed by
address, each with how they stand. An address with an account SHALL appear as
that account and SHALL NOT appear again as an invitation; an address with no
account SHALL appear as its newest invitation. One person SHALL never occupy two
rows — the question the list answers is whether somebody has access, and that
question has one answer per person.

#### Scenario: An account and an invitation to the same address are one row
- **WHEN** an administrator looks at the people, and an address has both an account and the invitation it was created from
- **THEN** that address appears once, as an account

#### Scenario: A resent invitation shows only the newest
- **WHEN** an administrator resends an invitation and then looks at the people
- **THEN** that address appears once, as the invitation now outstanding

#### Scenario: Somebody invited but not yet arrived is shown as invited
- **WHEN** an administrator invites an address and then looks at the people
- **THEN** that address appears as invited

#### Scenario: An administrator is shown as one
- **WHEN** an administrator looks at the people
- **THEN** their own address is shown as an administrator

### Requirement: An administrator invites from the screen
An administrator SHALL be able to invite an address from the screen. A message
that went out SHALL be confirmed; a message that did not SHALL show the link,
once, in that answer — it is never stored, so the screen cannot offer it again
and SHALL NOT appear to. An address that already has an account SHALL be refused
on the form.

#### Scenario: Inviting from the screen adds the person to the list
- **WHEN** an administrator invites an address from the screen
- **THEN** that address appears in the list as invited

#### Scenario: A message that could not be sent shows the link once
- **WHEN** an administrator invites an address whose message could not be sent
- **THEN** the link is shown to them
- **AND** it does not appear anywhere in the list afterwards

#### Scenario: An address that already has an account is refused on the form
- **WHEN** an administrator invites an address that already has an account
- **THEN** they are told it is already registered

### Requirement: An administrator revokes and resends from the rows
An administrator SHALL be able to revoke and resend from the row an invitation
occupies, and the list SHALL show what changed. Rows that are accounts SHALL
offer neither, because nothing in this system removes a host.

#### Scenario: Revoking from the row shows the invitation revoked
- **WHEN** an administrator revokes an invitation from its row
- **THEN** that address is shown as revoked

#### Scenario: Resending from the row sends a new message
- **WHEN** an administrator resends an invitation from its row
- **THEN** a message is sent to that address again
- **AND** the address still appears once

#### Scenario: An account offers neither
- **WHEN** an administrator looks at a row for an address that has an account
- **THEN** they are offered no way to revoke or resend it
