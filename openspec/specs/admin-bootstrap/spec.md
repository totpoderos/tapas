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

