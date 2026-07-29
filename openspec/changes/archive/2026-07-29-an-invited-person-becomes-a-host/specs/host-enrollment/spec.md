## ADDED Requirements

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
NOT reveal the link, so that reading the stored record confers no ability to
accept.

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
Accepting an invitation with a password that meets the policy SHALL create a
host account for the address the invitation was sent to, and SHALL mark the
invitation accepted. The account SHALL be an ordinary host — accepting an
invitation SHALL NOT produce an administrator.

#### Scenario: The invited person becomes a host and can sign in
- **WHEN** the invited person accepts their invitation with a strong password
- **THEN** a host account exists for the invited address
- **AND** that person can sign in with that address and password

#### Scenario: Accepting never produces an administrator
- **WHEN** the invited person accepts their invitation with a strong password
- **THEN** the account created is not an administrator

#### Scenario: Accepting does not by itself sign the person in
- **WHEN** the invited person accepts their invitation with a strong password
- **THEN** no session is granted by the acceptance itself

### Requirement: A link works only once
An accepted invitation's link SHALL NOT be usable again, so that an invitation
can create exactly one host account.

#### Scenario: An accepted link cannot be used again
- **WHEN** the invited person accepts their invitation, and then tries to accept with the same link again
- **THEN** accepting is refused because the link cannot be used

### Requirement: A link that cannot be used is refused without saying why
A link that is unknown and a link that has already been used SHALL be refused
identically, and the refusal SHALL reveal no address — so holding a link that
does not work tells its holder nothing about who was invited or whether the
invitation ever existed (OWASP A07 — no enumeration).

#### Scenario: An unknown link is refused
- **WHEN** someone tries to accept with a link that no invitation ever had
- **THEN** accepting is refused because the link cannot be used

#### Scenario: An already-used link is refused the same way
- **WHEN** someone tries to accept with a link whose invitation was already accepted
- **THEN** accepting is refused in the same way as for a link that never existed

#### Scenario: The refusal reveals no address
- **WHEN** someone tries to accept with a link whose invitation was already accepted
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
