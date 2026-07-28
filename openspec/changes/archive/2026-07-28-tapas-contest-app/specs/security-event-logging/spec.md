## ADDED Requirements

### Requirement: Sign-in outcomes are recorded
Every sign-in attempt SHALL be recorded in the security log — successes and refusals alike — stamped with the actor (when known), the source it came from, and when it happened.

#### Scenario: A successful sign-in is recorded
- **WHEN** a registered host signs in through the API
- **THEN** the security log records a successful sign-in for that host

#### Scenario: A refused sign-in is recorded with its reason
- **WHEN** a sign-in is attempted for a registered host with the wrong password
- **THEN** the security log records a refused sign-in noting the credentials were invalid

#### Scenario: A refused sign-in for an unknown account is still recorded
- **WHEN** a sign-in is attempted for an email that is not registered
- **THEN** the security log records a refused sign-in for an unknown account

### Requirement: Personal access token lifecycle is recorded
Issuing and using a personal access token SHALL be recorded in the security log, attributed to the owning host.

#### Scenario: Issuing a personal access token is recorded
- **WHEN** a signed-in host issues a personal access token
- **THEN** the security log records that a token was issued for that host

#### Scenario: Using a personal access token is recorded
- **WHEN** an external client acts as a host using that host's personal access token
- **THEN** the security log records that the token was used

### Requirement: The security log never stores secrets
The security log SHALL never contain a password or a full token.

#### Scenario: The security log never stores the attempted password
- **WHEN** a sign-in is attempted with the wrong password
- **THEN** no security log entry contains the attempted password

#### Scenario: The security log never stores a full token
- **WHEN** a host issues a personal access token
- **THEN** no security log entry contains the full token
