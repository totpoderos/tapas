# enroll-participants Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
### Requirement: A contest publishes with a roster of places
Publishing a contest SHALL create one open place per participant the host listed, keyed by the participant id the compiled constraint view uses, so a claimed place maps directly onto the scoring rules.

#### Scenario: The places not yet taken are shown for a valid code
- **WHEN** someone looks up a live contest by its join code
- **THEN** the places not yet claimed are offered as available

#### Scenario: An unknown join code is refused
- **WHEN** someone looks up a contest by a code that no contest has
- **THEN** the lookup is refused because the code is unknown

### Requirement: A participant claims a place by its join code
A person SHALL take part by claiming an open place on a live contest's roster, using the join code — no account, no password. Claiming returns a remember-me token scoped to that one contest and carrying the claimed participant identity.

#### Scenario: A participant claims their place
- **WHEN** a person claims an open place with the contest's join code
- **THEN** they are recognised as that participant
- **AND** they receive a token for that contest

#### Scenario: A returning participant is recognised by their token
- **WHEN** a person who has claimed a place returns to that contest with their token, no code given
- **THEN** they are recognised as the same participant

### Requirement: A place can be claimed only once, and only if it exists
Claiming SHALL be refused if the place is already taken, or if there is no such place on the contest's roster.

#### Scenario: A place already taken cannot be claimed again
- **WHEN** a person tries to claim a place that is already taken
- **THEN** the claim is refused because that place is taken

#### Scenario: A place that is not on the list cannot be claimed
- **WHEN** a person tries to claim a place that is not on the contest's roster
- **THEN** the claim is refused because there is no such place

### Requirement: A participant's token is contest-scoped and grants no host access
A claimed participant's token SHALL grant no access to any contest other than the one claimed, and no weight for any host-only action.

#### Scenario: A participant's token does not grant host access
- **WHEN** a person who has claimed a place tries a host-only action using their token
- **THEN** access is refused because a voter may not do that

### Requirement: A claimed place keeps the participant signed in, whatever browser they are using

Having claimed a place, a participant SHALL stay signed in for everything that follows — entering their dish, scoring, sending their vote, watching the reveal — in every browser the product supports, including Safari and the iOS browsers built on it. A participant SHALL NOT be shown as joined while the session behind that claim was never kept: either the claim signs them in, or it fails and says so.

The session SHALL be carried in a way that suits how the site is being served. Where the site is served over a secure connection, the session SHALL be restricted to secure connections. Where it is served without one, that restriction SHALL be lifted only when the deployment is explicitly a development one; anything else SHALL keep the restriction, so an unrecognised environment is always the safe one.

#### Scenario: A participant who has joined can enter their dish

- **WHEN** a participant claims a place and then submits the dish they brought
- **THEN** the dish is saved

#### Scenario: Joining is not reported as successful when the session was not kept

- **WHEN** a participant's browser will not keep the session the claim tried to give them
- **THEN** they are not shown as joined

#### Scenario: A secure deployment keeps the session restricted to secure connections

- **WHEN** the product is deployed for real
- **THEN** a session is only ever carried over a secure connection

#### Scenario: An unrecognised environment stays strict

- **WHEN** the running environment is not explicitly a development one
- **THEN** the session stays restricted to secure connections

### Requirement: A lost session is reported as being signed out, not as a failed save

When a participant's action is refused because they are no longer signed in, they SHALL be told that — and offered the way back to joining — rather than being shown a failure that invites them to try again. Retrying cannot succeed, so inviting it wastes the participant's time at the one moment they are standing in a room with a plate of food.

This SHALL hold on every screen a joined participant uses: entering their dish, scoring, and sending their vote.

#### Scenario: Entering a dish while signed out

- **WHEN** a participant submits their dish and is refused because they are not signed in
- **THEN** they are told they are not signed in and offered the way back to joining

#### Scenario: Scoring while signed out

- **WHEN** a participant's scoring screen is refused because they are not signed in
- **THEN** they are told they are not signed in rather than shown a loading failure

#### Scenario: A genuine failure still reads as one

- **WHEN** a participant submits their dish and it fails for a reason other than being signed out
- **THEN** they are told the dish could not be saved and invited to try again

