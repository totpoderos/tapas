## ADDED Requirements

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
