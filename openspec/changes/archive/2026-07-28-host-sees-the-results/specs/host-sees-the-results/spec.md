## ADDED Requirements

### Requirement: A host reads their own contest's results

A host SHALL be able to read the results of a contest they own once it has been revealed: the overall winner and each category's winner, by dish name, over a leaderboard of every dish's total. A tie SHALL be shown as joint winners, never resolved automatically. The results SHALL be refused until the contest is revealed, refused to a host who does not own that contest, and refused when no one is signed in.

#### Scenario: A host reads the winners of their revealed contest

- **WHEN** a host asks for the results of their own contest, after revealing it
- **THEN** they are given the overall winner by dish name, the winner of each category by dish name, and every dish's total

#### Scenario: A tie is shown as joint winners

- **WHEN** two dishes finish level at the top of a revealed contest
- **THEN** both are named as winners, and neither is picked over the other

#### Scenario: The results are held back until the contest is revealed

- **WHEN** a host asks for the results of a contest they own that has not been revealed
- **THEN** the results are withheld

#### Scenario: A host cannot read another host's results

- **WHEN** a host asks for the results of a contest belonging to someone else
- **THEN** they are refused

#### Scenario: Reading the results requires being signed in

- **WHEN** someone who is not signed in asks for a contest's results
- **THEN** they are refused

### Requirement: Host and participant see the same results

The results a host reads SHALL name the same winners, in the same order, as the results the contest's participants read. A dish SHALL be identified the same way to both — by the name it was submitted under.

#### Scenario: The two views agree

- **WHEN** a contest has been revealed and both its host and one of its participants read the results
- **THEN** the same dishes are named as winners, and the leaderboard is in the same order for both
