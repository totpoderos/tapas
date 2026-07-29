## ADDED Requirements

### Requirement: An administrator sees the invitations
An administrator SHALL be able to see the invitations, each showing the address
it was sent to, how it stands, and when it was issued. The listing SHALL NOT
reveal any link or token, and SHALL be administrative work — refused to an
ordinary host as not allowed and to nobody signed in as not signed in.

#### Scenario: An administrator sees the invitations and how they stand
- **WHEN** an administrator asks to see the invitations
- **THEN** each invitation is listed with the address it was sent to and how it stands

#### Scenario: An invitation whose time has run out is shown as expired
- **WHEN** an administrator asks to see the invitations more than 24 hours after one was issued
- **THEN** that invitation is shown as expired

#### Scenario: The listing reveals no link
- **WHEN** an administrator asks to see the invitations
- **THEN** no invitation's link appears in the listing

#### Scenario: An ordinary host cannot see the invitations
- **WHEN** a signed-in host who is not an administrator asks to see the invitations
- **THEN** access is refused as not allowed

### Requirement: An administrator revokes an invitation
An administrator SHALL be able to revoke an invitation that is still usable,
and its link SHALL stop working from that moment. Revoking SHALL be refused for
an invitation that is not usable — one already accepted, already revoked,
superseded, or out of time — because there is nothing left to revoke.

#### Scenario: A revoked link stops working
- **WHEN** an administrator revokes a pending invitation, and the invited person then tries to accept
- **THEN** accepting is refused because the link cannot be used
- **AND** no host account exists for the invited address

#### Scenario: A revoked link no longer opens either
- **WHEN** an administrator revokes a pending invitation, and the invited person then opens their link
- **THEN** opening is refused because the link cannot be used

#### Scenario: An accepted invitation cannot be revoked
- **WHEN** an administrator tries to revoke an invitation that was already accepted
- **THEN** revoking is refused because there is nothing to revoke

#### Scenario: An invitation cannot be revoked twice
- **WHEN** an administrator revokes an invitation and then tries to revoke it again
- **THEN** revoking is refused because there is nothing to revoke

### Requirement: An administrator resends an invitation
An administrator SHALL be able to resend an invitation, which SHALL issue a new
invitation to the same address with a new link and a fresh 24-hour window, and
SHALL end the old one as superseded. The old link SHALL stop working from that
moment — a link once mailed cannot be recalled, so the only safe resend is one
that leaves exactly one live link.

#### Scenario: Resending sends a new link to the same address
- **WHEN** an administrator resends a pending invitation
- **THEN** a message is sent to the same address
- **AND** it carries a different link from the first

#### Scenario: The new link works
- **WHEN** an administrator resends an invitation, and the invited person accepts with the new link
- **THEN** a host account exists for the invited address

#### Scenario: The old link dies the moment it is superseded
- **WHEN** an administrator resends a pending invitation, and the invited person tries to accept with the original link
- **THEN** accepting is refused because the link cannot be used

#### Scenario: The new invitation gets its own full window
- **WHEN** an administrator resends an invitation nearly 24 hours after it was issued, and the invited person accepts with the new link a day later
- **THEN** a host account exists for the invited address

### Requirement: An invitation can be resent after expiring, but not after a decision
An expired invitation SHALL be resendable, because expiring is something that
happened to it rather than something anybody chose. An accepted, revoked or
superseded invitation SHALL NOT be resendable, because each of those is a
decision — and reaching past a decision by resending would quietly undo it.

#### Scenario: An expired invitation can be resent
- **WHEN** an administrator resends an invitation whose time has run out
- **THEN** a new link is sent to the same address
- **AND** the invited person can accept with it

#### Scenario: A revoked invitation cannot be resent
- **WHEN** an administrator revokes an invitation and then tries to resend it
- **THEN** resending is refused because that invitation is finished

#### Scenario: An accepted invitation cannot be resent
- **WHEN** an administrator tries to resend an invitation that was already accepted
- **THEN** resending is refused because that invitation is finished

#### Scenario: A superseded invitation cannot be resent again
- **WHEN** an administrator resends an invitation and then tries to resend that same original invitation
- **THEN** resending is refused because that invitation is finished

## MODIFIED Requirements

### Requirement: A link works only once
An accepted invitation's link SHALL NOT be usable again, so that an invitation
can create exactly one host account. Neither SHALL a link be usable once its
time has run out, nor once it has been ended early by being revoked or
superseded — an invitation is good once, and only for a while, and only until
an administrator says otherwise.

#### Scenario: An accepted link cannot be used again
- **WHEN** the invited person accepts their invitation, and then tries to accept with the same link again
- **THEN** accepting is refused because the link cannot be used

#### Scenario: A link that has run out of time cannot be used
- **WHEN** more than 24 hours have passed since an invitation was issued, and the invited person tries to accept
- **THEN** accepting is refused because the link cannot be used

#### Scenario: A link that was ended early cannot be used
- **WHEN** an administrator revokes an invitation, and the invited person tries to accept while still well within the window
- **THEN** accepting is refused because the link cannot be used

### Requirement: A link that cannot be used is refused without saying why
A link SHALL be refused identically whether it is unknown, already used, out of
time, revoked, or superseded, and the refusal SHALL reveal no address — so
holding a link that does not work tells its holder nothing about who was
invited, whether the invitation ever existed, or which of the five reasons
applies (OWASP A07 — no enumeration). In particular a revoked link SHALL look
exactly like one that expired, so that nobody can tell they were deliberately
turned away.

#### Scenario: An unknown link is refused
- **WHEN** someone tries to accept with a link that no invitation ever had
- **THEN** accepting is refused because the link cannot be used

#### Scenario: An already-used link is refused the same way
- **WHEN** someone tries to accept with a link whose invitation was already accepted
- **THEN** accepting is refused in the same way as for a link that never existed

#### Scenario: An expired link is refused the same way
- **WHEN** someone tries to accept with a link whose invitation has expired
- **THEN** accepting is refused in the same way as for a link that never existed

#### Scenario: A revoked link is refused the same way
- **WHEN** someone tries to accept with a link whose invitation was revoked
- **THEN** accepting is refused in the same way as for a link that never existed

#### Scenario: A superseded link is refused the same way
- **WHEN** someone tries to accept with a link whose invitation was superseded by a resend
- **THEN** accepting is refused in the same way as for a link that never existed

#### Scenario: The refusal reveals no address
- **WHEN** someone tries to accept with a link whose invitation was already accepted
- **THEN** the refusal names no email address

#### Scenario: The refusal for an expired link reveals no address either
- **WHEN** someone tries to accept with a link whose invitation has expired
- **THEN** the refusal names no email address

#### Scenario: The refusal for a revoked link reveals no address either
- **WHEN** someone tries to accept with a link whose invitation was revoked
- **THEN** the refusal names no email address
