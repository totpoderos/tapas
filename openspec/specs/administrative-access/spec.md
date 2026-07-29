# administrative-access Specification

## Purpose
TBD - created by archiving change only-an-admin-does-admin-work. Update Purpose after archive.
## Requirements
### Requirement: An administrator can do administrative work
An administrator SHALL be able to do work that is reserved to administrators.
Seeing the list of host accounts is such work: an administrator SHALL be able
to see which host accounts exist and which of them are administrators.

#### Scenario: An administrator sees the list of host accounts
- **WHEN** an administrator asks to see the host accounts
- **THEN** every existing host account is listed
- **AND** each one shows whether it is an administrator

### Requirement: An ordinary host cannot do administrative work
Administrative work SHALL be refused to a host who is not an administrator, and
refused as not allowed rather than as not signed in — being signed in as the
wrong kind of person is a different answer from being nobody (OWASP A01).

#### Scenario: A host is refused administrative work
- **WHEN** a signed-in host who is not an administrator asks to see the host accounts
- **THEN** access is refused as not allowed

#### Scenario: Being refused tells the host nothing about what exists
- **WHEN** a signed-in host who is not an administrator asks to see the host accounts
- **THEN** the refusal reveals no host account

### Requirement: Administrative work requires being signed in
Administrative work SHALL be refused when no one is signed in, and SHALL be
refused as not signed in — distinctly from the refusal an ordinary host gets.

#### Scenario: Administrative work is refused when no one is signed in
- **WHEN** the host accounts are asked for with no one signed in
- **THEN** access is refused as not signed in

### Requirement: A personal access token never carries administrative authority
A personal access token SHALL grant the powers of a host and no more, whoever
issued it. An administrator acting through a token SHALL be able to do
everything a host can do, and SHALL be refused administrative work as not
allowed — so a leaked token can never reach the administrative surface.

#### Scenario: An administrator's token cannot do administrative work
- **WHEN** an administrator who has issued a personal access token has an external client use that token to ask to see the host accounts
- **THEN** access is refused as not allowed

#### Scenario: An administrator's token can still do a host's work
- **WHEN** an administrator who has issued a personal access token has an external client use that token to create a draft
- **THEN** the draft is created for that administrator

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

