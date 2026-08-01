## MODIFIED Requirements

### Requirement: Host and participant see the same results

The results a host reads and the results a participant reads SHALL be the same results: the same winners, the same order of dishes on the leaderboard, and the same name for every dish — including a dish nobody named, which both SHALL call by the name of the cook whose it is. The two screens MAY draw those results differently.

#### Scenario: Both are told the same winner

- **WHEN** a host and a participant read the results of the same revealed contest
- **THEN** the same dish wins on both

#### Scenario: Both call an unnamed dish the same thing

- **WHEN** the results include a dish that was scored but never named
- **THEN** the host and the participant see it under the same name
