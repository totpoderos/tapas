## ADDED Requirements

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
