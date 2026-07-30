## MODIFIED Requirements

### Requirement: A host can check a live progress tally
The host who owns a contest SHALL be able to check how many participants have claimed a place and how many have drafted or sent their vote — a live progress view, not the results themselves.

The tally SHALL also report how many places the contest's roster holds in total, so that a count of who has joined can be read against what it is out of. "Two have joined" says nothing on its own; "two of four have joined" is the answer a host running the contest is actually asking for.

#### Scenario: The host checks the tally of a contest in progress
- **WHEN** the host checks the tally of a contest where some participants have claimed a place, some have drafted scores, and one has sent a vote
- **THEN** the tally shows how many have claimed, how many are still drafting, and how many have sent

#### Scenario: The tally says what the counts are out of
- **WHEN** the host checks the tally of a contest whose roster holds four places, two of them claimed
- **THEN** the tally reports four places in total and two claimed

#### Scenario: A contest nobody has joined still says how many places there are
- **WHEN** the host checks the tally of a contest whose roster holds four places, none of them claimed
- **THEN** the tally reports four places in total and none claimed

#### Scenario: A host cannot check another host's tally
- **WHEN** a different host tries to check the tally of a contest they do not own
- **THEN** checking is refused as not allowed

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
