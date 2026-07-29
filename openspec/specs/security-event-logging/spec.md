# security-event-logging Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
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

### Requirement: A refused reach for administrative work is recorded
The security log SHALL record an attempt at administrative work that is refused
for lack of administrative authority, attributed to whoever made it and to the
source it came from. A host reaching for administrative work is a
privilege-escalation signal, and nothing else in the log would show it (OWASP
A09).

#### Scenario: A host refused administrative work is recorded
- **WHEN** a signed-in host who is not an administrator is refused administrative work
- **THEN** the security log records a refused administrative attempt for that host

#### Scenario: A token refused administrative work is recorded
- **WHEN** an external client using an administrator's personal access token is refused administrative work
- **THEN** the security log records a refused administrative attempt for that administrator

#### Scenario: Administrative work that succeeds is not noise in the log
- **WHEN** an administrator does administrative work successfully
- **THEN** no refused administrative attempt is recorded

