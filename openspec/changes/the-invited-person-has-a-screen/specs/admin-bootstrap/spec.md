## ADDED Requirements

### Requirement: An unclaimed deployment offers itself to be claimed
A deployment with no administrator SHALL offer a screen on which the configured
address can claim it, and anyone arriving anonymously SHALL be brought there
rather than to a sign-in screen no account can be used on.

#### Scenario: Someone arriving anonymously is brought to the claim screen
- **WHEN** someone opens an unclaimed deployment
- **THEN** they are shown the screen for claiming it

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
