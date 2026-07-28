## ADDED Requirements

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
