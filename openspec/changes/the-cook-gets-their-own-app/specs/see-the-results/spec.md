## ADDED Requirements

### Requirement: A participant waiting for the reveal is told how the voting stands

While a contest has been revealed to nobody yet, a participant who took part SHALL be able to see how many of the votes are in, out of how many are expected, and which participants have still to vote. This SHALL update while they wait, without them having to reload.

What SHALL be reported about another participant is whether their vote is in, and nothing else — not how many dishes they have scored, not which, and no value they gave. Whether a vote is in is the fact the reveal is waiting on; how far through someone is, is that person's business.

This read SHALL be refused to anyone who has not claimed a place on that contest, and SHALL carry no information about any other contest.

Where the standing cannot be read, the participant SHALL still be told that the results are being waited for, rather than being shown nothing or an error.

#### Scenario: Waiting says how many votes are in

- **WHEN** a participant waits for the reveal of a contest where some votes are in and some are not
- **THEN** they are told how many are in, out of how many are expected

#### Scenario: Waiting names who has still to vote

- **WHEN** a participant waits for the reveal of a contest where another participant has not sent their vote
- **THEN** that participant is named as still to vote

#### Scenario: How far someone has got is not reported

- **WHEN** a participant waits for the reveal of a contest where another participant has scored some dishes but not sent
- **THEN** they are told only that the vote is not in, and nothing about what has been scored

#### Scenario: The standing is not open to anyone who did not take part

- **WHEN** how the voting stands is read by someone who has not claimed a place on that contest
- **THEN** it is refused

#### Scenario: Waiting still works without the standing

- **WHEN** a participant waits for the reveal and how the voting stands cannot be read
- **THEN** they are still told that the results are being waited for

## MODIFIED Requirements

### Requirement: A participant reads a revealed contest's results

A participant who has claimed a place SHALL be able to read a contest's results once it has been revealed: the overall winner and each category's winner, by dish name, over a leaderboard of every dish's total. The overall winner SHALL also name the participant who brought the winning dish, so the result names a person as well as a plate. A tie SHALL be shown as joint winners, never resolved automatically. The results SHALL be refused until the contest is revealed, and refused when the requester has not claimed a place.

A dish SHALL keep being identified by the name it was submitted under; the cook is named alongside it, never in place of it.

#### Scenario: A participant reads the winners of a revealed contest

- **WHEN** a participant who took part reads the results of a fully-voted, revealed contest
- **THEN** they see the overall winner by name
- **AND** they see the winner of each category

#### Scenario: The overall winner names the cook as well as the dish

- **WHEN** a participant reads the results of a revealed contest
- **THEN** the winning dish is named, and so is the participant who brought it

#### Scenario: Joint winners each name their cook

- **WHEN** a participant reads the results of a revealed contest that ended in a tie
- **THEN** each winning dish is named, and so is the participant who brought it

#### Scenario: The results are held back until the contest is revealed

- **WHEN** a participant reads the results of a contest that has closed but not been revealed
- **THEN** they are told the results are not out yet

#### Scenario: Reading the results requires having claimed a place

- **WHEN** a contest's results are read with no participant token
- **THEN** it is refused as not signed in
