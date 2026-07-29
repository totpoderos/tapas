## ADDED Requirements

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
