## ADDED Requirements

### Requirement: A participant joins a live contest with a valid code
A participant SHALL be able to join a live contest using its join code and a display name, without an account. Joining SHALL return a remember-me token scoped to that one contest.

#### Scenario: A participant joins a live contest with a valid code
- **WHEN** a participant joins a live contest with join code "TAPAS1" and the display name "Marcos"
- **THEN** the join succeeds
- **AND** the participant receives a token for that contest

### Requirement: Joining with an unknown code is refused
An unrecognised join code SHALL refuse the join outright — no participant record is created.

#### Scenario: Joining with an unknown code is refused
- **WHEN** a participant tries to join with an unknown code "GHOST1" and the display name "Marcos"
- **THEN** the join is refused because the code is unknown

### Requirement: A returning participant is recognised by their token
A participant holding a valid remember-me token for a contest SHALL be recognised on return, without needing the join code again.

#### Scenario: A returning participant is recognised by their token, without the code
- **WHEN** a participant who already joined a live contest as "Marcos" returns to that contest with their token, no code given
- **THEN** they are recognised as "Marcos" without rejoining

### Requirement: A participant's token is scoped to a single contest
A participant's token SHALL grant no access to any contest other than the one they joined.

#### Scenario: A participant's token does not grant access to a different contest
- **WHEN** a participant who joined one live contest as "Marcos" tries to use their token on a second, unrelated live contest
- **THEN** access is refused because the token is not for that contest

### Requirement: A participant's token grants no host access
A participant's token SHALL carry no weight for any host-only action.

#### Scenario: A participant's token does not grant host access
- **WHEN** a participant who joined a live contest as "Marcos" tries to do a host-only action on that contest using their token
- **THEN** access is refused because a voter may not do that
