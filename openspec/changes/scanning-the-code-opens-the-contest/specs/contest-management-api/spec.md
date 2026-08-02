## ADDED Requirements

### Requirement: A contest reports the link that joins it
When a host reads a contest they own, the read SHALL report a **join link** beside its join code: the address that opens the participant app already carrying that contest's join code, so that following it asks nobody to type the code.

The join link SHALL be built from the participant address the deployment is configured with, so that a contest read from a deployment reports the link to that deployment's own participant app and not to another. It SHALL carry that address and the contest's join code, and nothing about the contest, its host, or its participants.

The join link SHALL carry the same join code the same read reports, so that a link can never lead somewhere other than the contest it was read from.

Reporting the link SHALL NOT require a further request: it arrives with the contest, as the join code does.

#### Scenario: A host reads their contest and is given the link that joins it
- **WHEN** a host reads a live contest they own
- **THEN** the read reports a join link as well as the join code
- **AND** the join link is the participant app's address carrying that contest's join code

#### Scenario: The join link carries the contest's own join code
- **WHEN** a host who owns two live contests reads each of them
- **THEN** each read reports a join link carrying that contest's own join code
- **AND** the two join links differ

#### Scenario: The join link says nothing else about the contest
- **WHEN** a host reads a live contest they own
- **THEN** the join link carries the participant address and the join code only
- **AND** it carries nothing about the contest's name, its host, or its participants

#### Scenario: The join link leads to the deployment's own participant app
- **WHEN** a contest is read on a deployment whose participant address is its own
- **THEN** the join link reported begins with that deployment's participant address
