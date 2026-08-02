# see-the-results Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
### Requirement: A participant reads a revealed contest's results

A participant who has claimed a place SHALL be able to read a contest's results once it has been revealed: the overall winner and each category's winner, by dish name, over a leaderboard of every dish's total. A tie SHALL be shown as joint winners, never resolved automatically. The results SHALL be refused until the contest is revealed, and refused when the requester has not claimed a place.

A dish nobody named SHALL be called by the name of the cook whose it is, and by both names where a couple brought it. It SHALL NOT be given a description in words, in any language: a name a person chose is data and reads the same to every reader, where a phrase written into the results would have to be translated and would arrive in the wrong language on the one screen the whole room reads together.

#### Scenario: A participant reads the winners of a revealed contest

- **WHEN** a participant who took part reads the results of a fully-voted, revealed contest
- **THEN** they see the overall winner by name
- **AND** they see the winner of each category

#### Scenario: A dish nobody named is called by its cook

- **WHEN** the results include a dish that was scored but never named
- **THEN** that dish is called by the name of the cook whose it is

#### Scenario: A dish two people brought takes both their names

- **WHEN** a dish a couple brought was never named
- **THEN** it is called by both their names

#### Scenario: The cook is not named twice over

- **WHEN** the winning dish is one nobody named, so it is already called by its cook
- **THEN** the cook is not also named again beneath it

#### Scenario: The results are held back until the contest is revealed

- **WHEN** a participant reads the results of a contest that has closed but not been revealed
- **THEN** they are told the results are not out yet

#### Scenario: Reading the results requires having claimed a place

- **WHEN** a contest's results are read with no participant token
- **THEN** it is refused as not signed in

### Requirement: The results screen is never a dead end

From the results screen a participant SHALL always be able to reach the other steps open to them — the dishes, and their scoring — whichever way they arrived. This SHALL hold **while the screen is still waiting** for the host to reveal, which is where a participant spends the longest and where there is otherwise nothing on the page at all.

#### Scenario: Waiting for the reveal is not being stuck

- **WHEN** a participant is waiting on the results screen for the host to reveal
- **THEN** they can still reach the dishes and their scoring from it

#### Scenario: Moving on once the results are out

- **WHEN** a participant is reading the revealed results
- **THEN** they can still reach the other steps open to them

#### Scenario: Arriving directly is no different

- **WHEN** a participant opens the results screen's address directly
- **THEN** the same ways onward are open to them as if they had followed a link

