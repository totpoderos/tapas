## ADDED Requirements

### Requirement: The app can tell an administrator from a host
The system SHALL let a signed-in person's own app learn what they are, in the
same answer that tells it they are signed in at all. Knowing SHALL cost one
read, and SHALL NOT be discovered by attempting administrative work and reading
the refusal — doing that would record a refused administrative attempt for every
ordinary host on every visit, and bury the one record that means somebody
reached for something.

#### Scenario: A signed-in administrator is reported as one
- **WHEN** a signed-in administrator's app asks who it is talking to
- **THEN** it is told they are signed in and that they are an administrator

#### Scenario: A signed-in host is reported as one
- **WHEN** a signed-in host's app asks who it is talking to
- **THEN** it is told they are signed in and that they are not an administrator

#### Scenario: Nobody signed in is reported as nobody
- **WHEN** an app with no one signed in asks who it is talking to
- **THEN** it is told nobody is

#### Scenario: Finding out records no refused attempt
- **WHEN** a signed-in host's app asks who it is talking to
- **THEN** the security log records no refused administrative attempt

### Requirement: An administrator is offered the way to the people
An administrator SHALL be offered a way to reach the people in their deployment
from the app itself, and a host SHALL NOT be offered it.

#### Scenario: An administrator is offered the way
- **WHEN** an administrator looks at their own home screen
- **THEN** they are offered the way to the people in their deployment

#### Scenario: A host is not
- **WHEN** a host looks at their own home screen
- **THEN** they are offered no such way

### Requirement: A host who reaches the administrative screen is told plainly
A host who reaches the administrative screen SHALL be told it is not for them,
and SHALL NOT be sent somewhere else instead. Their attempt SHALL be recorded as
a refused administrative attempt, because reaching the administrative surface
without the authority for it is what that record is for.

#### Scenario: A host is told rather than moved
- **WHEN** a host opens the administrative screen
- **THEN** they are told it is not for them
- **AND** they are left where they are

#### Scenario: The attempt is recorded
- **WHEN** a host opens the administrative screen
- **THEN** the security log records a refused administrative attempt for that host

#### Scenario: The screen reveals nobody
- **WHEN** a host opens the administrative screen
- **THEN** no other person's address appears on it
