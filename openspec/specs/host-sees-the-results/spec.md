# host-sees-the-results Specification

## Purpose
TBD - created by archiving change host-sees-the-results. Update Purpose after archive.
## Requirements
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

The results a host reads and the results a participant reads SHALL be the same results: the same winners, the same order of dishes on the leaderboard, and the same name for every dish — including a dish nobody named, which both SHALL call by the name of the cook whose it is. The two screens MAY draw those results differently.

#### Scenario: Both are told the same winner

- **WHEN** a host and a participant read the results of the same revealed contest
- **THEN** the same dish wins on both

#### Scenario: Both call an unnamed dish the same thing

- **WHEN** the results include a dish that was scored but never named
- **THEN** the host and the participant see it under the same name

