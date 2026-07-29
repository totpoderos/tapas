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

