# admin-bootstrap Specification

## Purpose
TBD - created by archiving change the-first-administrator-is-created. Update Purpose after archive.
## Requirements
### Requirement: A deployment names its administrator before it starts
A deployment SHALL be configured with the address of the person who will
administer it, and SHALL refuse to start in production while that setting still
holds its committed development value. Naming the address out of band is what
makes claiming safe: the invitation link proves only that its recipient holds
the inbox they typed, which at first run would be their own.

#### Scenario: A production deployment refuses to start with the development address
- **WHEN** a production deployment is configured with the committed development address
- **THEN** it refuses to start, saying which setting is at fault

#### Scenario: A deployment refuses to start with an address that is not an address
- **WHEN** a deployment is configured with an administrator address that is not a valid email address
- **THEN** it refuses to start

### Requirement: Only the configured address can claim an unclaimed deployment
While no administrator exists, the configured address SHALL be able to claim the
deployment, and any other address SHALL be refused. Whoever controls the
deployment's configuration decides who administers it; whoever merely reaches
the URL first decides nothing.

#### Scenario: The configured address claims the deployment
- **WHEN** the configured address claims a deployment that has no administrator
- **THEN** an invitation is sent to that address

#### Scenario: Another address cannot claim the deployment
- **WHEN** an address other than the configured one tries to claim a deployment that has no administrator
- **THEN** claiming is refused
- **AND** no invitation is sent

#### Scenario: A refused claim sends nothing to the address that was offered
- **WHEN** an address other than the configured one tries to claim the deployment
- **THEN** no message is sent to that address

### Requirement: Claiming the deployment makes an administrator
An invitation issued by claiming SHALL create an administrator when it is
accepted, by the same steps as any other invitation — open the link, choose a
password. Accepting SHALL NOT by itself sign the new administrator in.

#### Scenario: The person who claimed the deployment becomes its administrator
- **WHEN** the configured address claims the deployment and accepts the invitation with a strong password
- **THEN** an administrator account exists for that address
- **AND** that administrator can do administrative work

#### Scenario: Claiming does not sign anybody in by itself
- **WHEN** the configured address claims the deployment and accepts the invitation
- **THEN** no session is granted by the acceptance itself

### Requirement: A lost message never leaves a deployment unclaimable
The deployment SHALL send a fresh link and end the previous one when the
configured address is offered again while its invitation is still outstanding,
so that a message lost in transit cannot strand a deployment. This is safe only because the address is
fixed in configuration: every such message can go to one inbox and no other.

#### Scenario: Claiming again sends a fresh link
- **WHEN** the configured address claims a deployment whose earlier invitation is still outstanding
- **THEN** another message is sent to that address
- **AND** it carries a different link

#### Scenario: The earlier link stops working
- **WHEN** the configured address claims the deployment twice, and the earlier link is then used
- **THEN** accepting is refused because the link cannot be used

### Requirement: The door closes once the deployment has an administrator
Once an administrator exists, claiming SHALL be refused, and the deployment
SHALL report that it is no longer unclaimed. There SHALL be no self-service way
to become an administrator of a deployment that already has one.

#### Scenario: An unclaimed deployment says so
- **WHEN** anyone asks whether a deployment with no administrator is unclaimed
- **THEN** it reports that it is

#### Scenario: A claimed deployment says so
- **WHEN** anyone asks whether a deployment that has an administrator is unclaimed
- **THEN** it reports that it is not

#### Scenario: The configured address cannot claim a deployment twice
- **WHEN** the configured address tries to claim a deployment that already has an administrator
- **THEN** claiming is refused because the deployment is already claimed

### Requirement: A deployment has at most one administrator
A deployment SHALL never hold more than one administrator, whatever any request
asks for — two people claiming at the same moment SHALL produce one
administrator and one refusal, not two administrators.

#### Scenario: Simultaneous claims produce a single administrator
- **WHEN** two attempts to accept a claim on an unclaimed deployment are made at the same moment
- **THEN** exactly one administrator exists afterwards

### Requirement: A claim whose message cannot be sent is not silently lost
A claim SHALL stand even when its message cannot be handed off, and whoever
claimed SHALL be told that it did not go out and offered the link in that
answer. A first-run deployment has no administrator to resend anything, so a
claim that failed quietly would leave it unclaimable until its invitation ran
out of time.

#### Scenario: A claim survives a message that could not be sent
- **WHEN** the configured address claims a deployment and the message cannot be handed off
- **THEN** the claim stands
- **AND** the link is offered in that answer

#### Scenario: The claim can still be accepted
- **WHEN** the configured address claims a deployment, the message cannot be handed off, and the link from that answer is used
- **THEN** an administrator account exists for the configured address

#### Scenario: Claiming is not reported as having failed
- **WHEN** the configured address claims a deployment and the message cannot be handed off
- **THEN** claiming is not refused

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

