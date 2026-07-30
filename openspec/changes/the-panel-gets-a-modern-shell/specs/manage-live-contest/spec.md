## ADDED Requirements

### Requirement: A host can hand the join code over by scanning
A host running a live contest SHALL be able to show its join code as a scannable code, as well as copy it as text, so that people at the venue can join without the code being read out. The scannable code SHALL carry the same join code the contest reports and nothing else about the contest, SHALL be generated where it is shown rather than fetched, and SHALL carry the code in writing beside it so that a person who cannot scan it can still be told it.

#### Scenario: The host shows the join code as a scannable code
- **WHEN** a host of a live contest asks to show its join code as a scannable code
- **THEN** a scannable code for that contest's join code is shown
- **AND** the join code is still readable in writing beside it

#### Scenario: The scannable code says nothing else about the contest
- **WHEN** a scannable code is shown for a contest's join code
- **THEN** it carries the join code only, and nothing about the contest, its host, or its participants

#### Scenario: A contest with no join code offers no scannable code
- **WHEN** a host opens a contest still being prepared
- **THEN** no scannable code is offered, because no join code has been issued

#### Scenario: Copying the code remains available
- **WHEN** a host of a live contest asks to copy its join code
- **THEN** the join code is copied, and the host is told it was
