# host-enrollment Specification

## Purpose
TBD - created by archiving change an-invited-person-becomes-a-host. Update Purpose after archive.
## Requirements
### Requirement: Only an administrator invites someone to become a host
An administrator SHALL be able to invite an email address to become a host. The
invitation SHALL be refused to a host who is not an administrator, as not
allowed, and refused as not signed in when no one is signed in — inviting is
administrative work and is the only route by which a host account comes into
existence.

#### Scenario: An administrator invites an address
- **WHEN** an administrator invites "nuevo@example.com"
- **THEN** an invitation for that address is pending

#### Scenario: An ordinary host cannot invite
- **WHEN** a signed-in host who is not an administrator tries to invite "nuevo@example.com"
- **THEN** access is refused as not allowed
- **AND** no invitation exists for that address

#### Scenario: Inviting requires being signed in
- **WHEN** someone with no one signed in tries to invite "nuevo@example.com"
- **THEN** access is refused as not signed in

### Requirement: Inviting an address that already has an account is refused
Inviting SHALL be refused when a host account already exists for that address,
so an invitation can never be issued that could not be accepted.

#### Scenario: An address that already has an account cannot be invited
- **WHEN** an administrator invites an address that already belongs to a host
- **THEN** inviting is refused because that address is already registered

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

### Requirement: Opening the link changes nothing
Opening an invitation link SHALL report that it is still good and which address
it is for, and SHALL leave the invitation exactly as it was. Mail-security
products and link scanners open such links before any person does, so opening
one SHALL never be what spends it.

#### Scenario: Opening a good link says whom it is for
- **WHEN** the invited person opens their link
- **THEN** the invitation is reported as still good
- **AND** it names the address it was sent to

#### Scenario: Opening a link does not spend it
- **WHEN** the invited person opens their link twice, and then accepts with a strong password
- **THEN** the host account is created

### Requirement: Accepting creates a host account for the invited address
Accepting an invitation with a password that meets the policy SHALL create an
account for the address the invitation was sent to, and SHALL mark the
invitation accepted. An invitation issued by an administrator SHALL produce an
ordinary host and never another administrator — the only invitation that
produces an administrator is the one that claims an unclaimed deployment.

#### Scenario: The invited person becomes a host and can sign in
- **WHEN** the invited person accepts their invitation with a strong password
- **THEN** a host account exists for the invited address
- **AND** that person can sign in with that address and password

#### Scenario: An invitation from an administrator never produces another administrator
- **WHEN** an administrator invites someone and that person accepts with a strong password
- **THEN** the account created is not an administrator

#### Scenario: A resent invitation still produces an ordinary host
- **WHEN** an administrator resends an invitation and the invited person accepts with the new link
- **THEN** the account created is not an administrator

#### Scenario: Accepting does not by itself sign the person in
- **WHEN** the invited person accepts their invitation with a strong password
- **THEN** no session is granted by the acceptance itself

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

### Requirement: A password that fails the policy does not spend the invitation
Accepting with a password that does not meet the policy SHALL be refused, and
SHALL leave the invitation pending — a person who mistypes a password must not
lose their only way in.

#### Scenario: A weak password is refused
- **WHEN** the invited person tries to accept with the weak password "short"
- **THEN** accepting is refused because the password is too weak

#### Scenario: The invitation still works after a refused password
- **WHEN** the invited person is refused for a weak password, and then accepts with a strong one
- **THEN** the host account is created

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

### Requirement: An invited person has a screen to accept on
Opening an invitation link SHALL bring the invited person to a screen naming
the address the invitation was sent to and asking them to choose a password.
Choosing one SHALL create their account and leave them signed in and looking at
their own contests.

#### Scenario: The screen names who the invitation was for
- **WHEN** an invited person opens their link
- **THEN** they are shown the address their invitation was sent to

#### Scenario: Choosing a password finishes the account and signs them in
- **WHEN** an invited person opens their link and chooses a strong password
- **THEN** they are signed in
- **AND** they are looking at their own contests

#### Scenario: A password that fails the policy is refused on the screen
- **WHEN** an invited person opens their link and chooses a password that does not meet the policy
- **THEN** they are told so on the screen
- **AND** they can choose another without their link stopping working

### Requirement: A link that does not work says so without saying which
A screen reached with a link that cannot be used SHALL say that it cannot be
used, SHALL suggest asking whoever invited them for a new one, and SHALL NOT
tell them which of the reasons applied. It SHALL look the same whether the link
never existed, was already used, ran out of time, was revoked, or was replaced —
the system does not distinguish these to whoever holds the link, and the screen
must not appear to.

#### Scenario: A used link gets the unusable screen
- **WHEN** someone opens a link whose invitation was already accepted
- **THEN** they are told the link cannot be used
- **AND** they are told to ask whoever invited them for a new one

#### Scenario: An expired link gets the same screen
- **WHEN** someone opens a link whose invitation has run out of time
- **THEN** they are shown the same thing as for a link that was already used

#### Scenario: The screen offers no way to choose a password
- **WHEN** someone opens a link that cannot be used
- **THEN** they are not asked for a password

#### Scenario: The screen names nobody
- **WHEN** someone opens a link that cannot be used
- **THEN** no email address appears on the screen

### Requirement: An account that was created says so, even when signing in fails
The screen SHALL say the account is ready and offer the way to sign in when
accepting created it but the sign-in that follows was refused. It SHALL NOT
suggest that accepting failed — it did not, and telling somebody to try again
would send them back to a link that no longer works.

#### Scenario: A refused sign-in does not read as a refused acceptance
- **WHEN** an invited person chooses a password, their account is created, and signing in is then refused
- **THEN** they are told their account is ready
- **AND** they are offered the way to sign in

