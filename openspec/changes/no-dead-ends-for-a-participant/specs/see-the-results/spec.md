## ADDED Requirements

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
