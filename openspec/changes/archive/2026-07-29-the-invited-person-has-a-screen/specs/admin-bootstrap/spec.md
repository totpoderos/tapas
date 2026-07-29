## ADDED Requirements

### Requirement: An unclaimed deployment offers itself to be claimed
A deployment with no administrator SHALL offer a screen on which the configured
address can claim it, and the sign-in screen SHALL offer the way to it. Sign-in
SHALL remain usable: a deployment can hold host accounts while having no
administrator, and taking those hosts to a screen they cannot use would lock
them out of one they can.

#### Scenario: Sign-in offers the way to set the deployment up
- **WHEN** someone opens the sign-in screen of an unclaimed deployment
- **THEN** they are offered the way to set it up

#### Scenario: A host can still sign in to an unclaimed deployment
- **WHEN** a host with an account opens the sign-in screen of an unclaimed deployment
- **THEN** they can sign in

#### Scenario: A claimed deployment offers nothing to set up
- **WHEN** someone opens the sign-in screen of a deployment that has an administrator
- **THEN** they are not offered a way to set it up

#### Scenario: Claiming from the screen sends the message
- **WHEN** the configured address is offered on the claim screen of an unclaimed deployment
- **THEN** they are told to look in that inbox

#### Scenario: Another address is refused on the screen
- **WHEN** an address other than the configured one is offered on the claim screen
- **THEN** they are told the claim was refused
- **AND** the screen does not reveal which address would have worked

### Requirement: A claimed deployment says so rather than hiding the screen
The claim screen SHALL remain reachable once a deployment has an administrator,
and SHALL say plainly that it already has one and offer the way to sign in. It
SHALL decide this by asking, not from whoever is signed in, so that it is the
one screen whose answer does not depend on the visitor.

#### Scenario: The claim screen tells a late arrival the deployment is taken
- **WHEN** someone opens the claim screen of a deployment that already has an administrator
- **THEN** they are told it already has one
- **AND** they are offered the way to sign in

#### Scenario: A claimed deployment does not send anyone to the claim screen
- **WHEN** someone opens a deployment that already has an administrator
- **THEN** they are shown the sign-in screen

### Requirement: A claim whose message could not be sent shows the link on the screen
When claiming reports that its message could not be sent, the screen SHALL show
the link. A deployment being claimed has no administrator to resend for it, and
its mail is the thing most likely not to be working yet — so telling somebody to
look in an inbox nothing was sent to would leave them with no way forward at
all.

#### Scenario: The link is shown when the message did not go out
- **WHEN** the configured address claims a deployment whose message could not be sent
- **THEN** the link is shown on the screen
- **AND** they are not told to look in their inbox

#### Scenario: The link is not shown when the message did go out
- **WHEN** the configured address claims a deployment whose message was sent
- **THEN** no link is shown on the screen
