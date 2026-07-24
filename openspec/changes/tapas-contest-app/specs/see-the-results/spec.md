## ADDED Requirements

### Requirement: A participant reads a revealed contest's results
A participant who has claimed a place SHALL be able to read a contest's results once it has been revealed: the overall winner and each category's winner, by dish name, over a leaderboard of every dish's total. A tie SHALL be shown as joint winners, never resolved automatically. The results SHALL be refused until the contest is revealed, and refused when the requester has not claimed a place.

#### Scenario: A participant reads the winners of a revealed contest
- **WHEN** a participant who took part reads the results of a fully-voted, revealed contest
- **THEN** they see the overall winner by name
- **AND** they see the winner of each category

#### Scenario: The results are held back until the contest is revealed
- **WHEN** a participant reads the results of a contest that has closed but not been revealed
- **THEN** they are told the results are not out yet

#### Scenario: Reading the results requires having claimed a place
- **WHEN** a contest's results are read with no participant token
- **THEN** it is refused as not signed in
