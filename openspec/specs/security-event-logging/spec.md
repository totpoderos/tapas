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

### Requirement: The life of an invitation is recorded
The security log SHALL record an invitation being issued and being accepted,
each stamped with the source it came from, and the issuing recorded against the
administrator who issued it. An invitation is the route by which a host account
comes into existence, so this is the audit trail for account creation itself
(OWASP A09).

#### Scenario: Issuing an invitation is recorded
- **WHEN** an administrator invites "nuevo@example.com"
- **THEN** the security log records an invitation issued by that administrator

#### Scenario: Accepting an invitation is recorded
- **WHEN** the invited person accepts their invitation with a strong password
- **THEN** the security log records the invitation accepted

### Requirement: A refused attempt to accept is recorded
The security log SHALL record an attempt to accept that was refused because the
link could not be used, stamped with the source it came from and noting whether
the link had expired. Someone guessing at links is a signal, and the generic
refusal shown to them deliberately says nothing — so the log is the only place
it can be seen, and the only place an expiry can be told apart from a guess.

#### Scenario: A refused acceptance is recorded
- **WHEN** someone tries to accept with a link that no invitation ever had
- **THEN** the security log records a refused acceptance

#### Scenario: A refusal for an expired link is recorded as an expiry
- **WHEN** the invited person tries to accept more than 24 hours after the invitation was issued
- **THEN** the security log records a refused acceptance noting the link had expired

#### Scenario: A refusal for an unknown link is not recorded as an expiry
- **WHEN** someone tries to accept with a link that no invitation ever had
- **THEN** the security log does not describe that refusal as an expiry

### Requirement: The security log never stores an invitation link
The security log SHALL NOT contain an invitation link or its token, in the same
way it never contains a password or a full personal access token.

#### Scenario: The security log never stores the link
- **WHEN** an administrator invites "nuevo@example.com"
- **THEN** no security log entry contains that invitation's link

