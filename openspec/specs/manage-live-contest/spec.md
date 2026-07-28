# manage-live-contest Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
### Requirement: A contest stops accepting anything once it closes
A live contest SHALL stop accepting dish submissions, score writes, and vote sends once it has closed. Once closed, a contest SHALL stay closed.

#### Scenario: A closed contest refuses further dishes, scores, and votes
- **WHEN** a participant tries to submit a dish, save a score, or send a vote on a contest that has closed
- **THEN** each attempt is refused because the contest is closed

### Requirement: A host can close a contest directly
The host who owns a live contest SHALL be able to close it at will.

#### Scenario: The host closes a contest directly
- **WHEN** the host closes their live contest
- **THEN** the contest is closed

#### Scenario: A host cannot close another host's contest
- **WHEN** a different host tries to close a contest they do not own
- **THEN** closing is refused as not allowed

#### Scenario: Closing an already-closed contest changes nothing
- **WHEN** the host tries to close a contest that has already closed
- **THEN** closing is refused because the contest is already closed

### Requirement: A contest can close on its own once everyone who joined has voted
A contest configured to close once everyone has sent their vote SHALL close automatically the moment every participant who claimed a place has sent their vote. A participant who never claimed a place SHALL NOT block this.

#### Scenario: A contest closes on its own once everyone who joined has voted
- **WHEN** every participant who claimed a place in a contest set to close once everyone has voted has sent their vote
- **THEN** the contest is closed

#### Scenario: A contest does not close early while someone has not yet voted
- **WHEN** one participant who claimed a place has not yet sent their vote, in a contest set to close once everyone has voted
- **THEN** the contest is still live

### Requirement: A contest can close automatically at a scheduled time
A contest configured with a scheduled close time SHALL close automatically once that time has passed.

#### Scenario: A contest closes automatically once its scheduled time arrives
- **WHEN** a contest scheduled to close at a set time is checked after that time has passed
- **THEN** the contest is closed

### Requirement: A host can reveal a closed contest
The host who owns a closed contest SHALL be able to reveal it. Reveal SHALL be refused for a contest that has not closed, and refused once a contest has already been revealed.

#### Scenario: The host reveals results for a closed contest
- **WHEN** the host reveals their closed contest
- **THEN** the contest is revealed

#### Scenario: Reveal is refused before the contest has closed
- **WHEN** the host tries to reveal a live contest that has not yet closed
- **THEN** reveal is refused because the contest has not closed

#### Scenario: Reveal cannot happen twice
- **WHEN** the host tries to reveal a contest that has already been revealed
- **THEN** reveal is refused because it has already been revealed

#### Scenario: A host cannot reveal another host's contest
- **WHEN** a different host tries to reveal a closed contest they do not own
- **THEN** reveal is refused as not allowed

### Requirement: A contest can reveal automatically at a scheduled time
A closed contest configured with a scheduled reveal time SHALL reveal automatically once that time has passed.

#### Scenario: A contest reveals automatically once its scheduled reveal time arrives
- **WHEN** a closed contest scheduled to reveal at a set time is checked after that time has passed
- **THEN** the contest is revealed

### Requirement: A host can check a live progress tally
The host who owns a contest SHALL be able to check how many participants have claimed a place and how many have drafted or sent their vote — a live progress view, not the results themselves.

#### Scenario: The host checks the tally of a contest in progress
- **WHEN** the host checks the tally of a contest where some participants have claimed a place, some have drafted scores, and one has sent a vote
- **THEN** the tally shows how many have claimed, how many are still drafting, and how many have sent

#### Scenario: A host cannot check another host's tally
- **WHEN** a different host tries to check the tally of a contest they do not own
- **THEN** checking is refused as not allowed

