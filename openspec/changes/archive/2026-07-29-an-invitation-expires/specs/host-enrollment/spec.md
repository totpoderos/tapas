## ADDED Requirements

### Requirement: An invitation is good for a limited time
An invitation SHALL be good for 24 hours from the moment it was issued. After
that its link SHALL neither open nor accept, so a message left unread in an old
inbox, forwarded, or kept in an archive stops being a working way into the
system.

#### Scenario: A link still works within the window
- **WHEN** the invited person accepts nearly 24 hours after the invitation was issued
- **THEN** the host account is created

#### Scenario: A link no longer accepts once the window has passed
- **WHEN** the invited person tries to accept more than 24 hours after the invitation was issued
- **THEN** accepting is refused because the link cannot be used
- **AND** no host account exists for the invited address

#### Scenario: A link no longer opens once the window has passed
- **WHEN** the invited person opens their link more than 24 hours after the invitation was issued
- **THEN** opening is refused because the link cannot be used

#### Scenario: An expired invitation stays expired
- **WHEN** an invitation has expired
- **THEN** nothing about opening or accepting it makes it usable again

## MODIFIED Requirements

### Requirement: A link works only once
An accepted invitation's link SHALL NOT be usable again, so that an invitation
can create exactly one host account. Neither SHALL a link be usable once its
time has run out — an invitation is good once, and only for a while.

#### Scenario: An accepted link cannot be used again
- **WHEN** the invited person accepts their invitation, and then tries to accept with the same link again
- **THEN** accepting is refused because the link cannot be used

#### Scenario: A link that has run out of time cannot be used
- **WHEN** more than 24 hours have passed since an invitation was issued, and the invited person tries to accept
- **THEN** accepting is refused because the link cannot be used

### Requirement: A link that cannot be used is refused without saying why
A link SHALL be refused identically whether it is unknown, already used, or out
of time, and the refusal SHALL reveal no address — so holding a link that does
not work tells its holder nothing about who was invited, whether the invitation
ever existed, or which of the three reasons applies (OWASP A07 — no
enumeration).

#### Scenario: An unknown link is refused
- **WHEN** someone tries to accept with a link that no invitation ever had
- **THEN** accepting is refused because the link cannot be used

#### Scenario: An already-used link is refused the same way
- **WHEN** someone tries to accept with a link whose invitation was already accepted
- **THEN** accepting is refused in the same way as for a link that never existed

#### Scenario: An expired link is refused the same way
- **WHEN** someone tries to accept with a link whose invitation has expired
- **THEN** accepting is refused in the same way as for a link that never existed

#### Scenario: The refusal reveals no address
- **WHEN** someone tries to accept with a link whose invitation was already accepted
- **THEN** the refusal names no email address

#### Scenario: The refusal for an expired link reveals no address either
- **WHEN** someone tries to accept with a link whose invitation has expired
- **THEN** the refusal names no email address
