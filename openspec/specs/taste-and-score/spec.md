# taste-and-score Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
### Requirement: A judge scores a dish open to them
A judge SHALL be able to save a score for a dish, checked against the compiled constraint view: the dish must be open to them, the category must be one of the contest's, and the score must fall within their allowed range.

#### Scenario: A judge scores a dish that is open to them
- **WHEN** a judge saves a score for a dish open to them, within the allowed range, in a real category
- **THEN** the score is saved

#### Scenario: A judge may not score their own dish
- **WHEN** a judge tries to score their own dish
- **THEN** scoring is refused because that dish is not open to them

#### Scenario: A score outside the allowed range is refused
- **WHEN** a judge tries to save a score outside their allowed range
- **THEN** scoring is refused because the score is out of range

#### Scenario: A score in an unknown category is refused
- **WHEN** a judge tries to save a score in a category that does not exist
- **THEN** scoring is refused because the category is unknown

### Requirement: A judge revises a draft score freely
While their vote session is a draft, a judge SHALL be able to change a score they already saved, without creating a second score for the same dish and category.

#### Scenario: A judge revises a score before sending
- **WHEN** a judge who already scored a dish saves a new score for the same dish and category
- **THEN** their score reflects the new value
- **AND** they still have only one score for that dish and category

### Requirement: A judge sees their own draft scores
A judge SHALL be able to see the scores they have saved so far.

#### Scenario: A judge sees their own draft scores
- **WHEN** a judge who has saved a score looks at their scores
- **THEN** the score they saved is there

### Requirement: Scoring requires having claimed a place
Only a participant who has claimed a place SHALL be able to save a score.

#### Scenario: Scoring requires having claimed a place
- **WHEN** a score is saved with no participant token
- **THEN** scoring is refused as not signed in

### Requirement: A judge sends their vote once it is complete
A judge SHALL be able to send their vote once every dish open to them has been scored in every category. Sending locks the vote.

#### Scenario: A judge sends a complete vote
- **WHEN** a judge who has scored every dish open to them, in every category, sends their vote
- **THEN** their vote is locked as sent

#### Scenario: An incomplete vote cannot be sent
- **WHEN** a judge who has left a dish unscored tries to send their vote
- **THEN** sending is refused because their vote is incomplete

### Requirement: A strict-ranking vote must use each value exactly once per category
When the contest requires a strict ranking, sending SHALL be refused unless every category's scores are a permutation of `1..N` (each value used exactly once), where `N` is the number of dishes open to the judge.

#### Scenario: A ranking vote must use each value exactly once
- **WHEN** a judge in a strict-ranking contest tries to send a vote where a category repeats a value
- **THEN** sending is refused because each score in that category must be used exactly once

### Requirement: A sent vote is locked
Once a vote session is sent, the API SHALL refuse any further score writes against it, and SHALL refuse sending it again.

#### Scenario: A sent vote cannot be changed
- **WHEN** a judge who has sent their vote tries to save another score
- **THEN** saving is refused because their vote has already been sent

#### Scenario: A vote cannot be sent twice
- **WHEN** a judge who has sent their vote tries to send it again
- **THEN** sending is refused because their vote has already been sent

### Requirement: Sending a vote requires having claimed a place
Only a participant who has claimed a place SHALL be able to send a vote.

#### Scenario: Sending a vote requires having claimed a place
- **WHEN** a vote is sent with no participant token
- **THEN** sending is refused as not signed in

### Requirement: A participant can tell that their vote is already in

A participant SHALL be able to find out whether their own vote is still a draft or has already been sent, and that answer SHALL come from what is recorded rather than from what a screen happens to remember — so it holds however they arrive: by a link, by going back, by reloading, or by opening the address directly.

Where a vote has been sent, the participant SHALL be shown that it is sent, together with the scores they gave, and SHALL NOT be offered any way to change or resend it. Where it is still a draft, they SHALL be able to carry on scoring as before.

#### Scenario: Coming back to scoring after voting

- **WHEN** a participant who has sent their vote returns to the scoring screen
- **THEN** they are shown that their vote is already in, and the scores they gave

#### Scenario: A sent vote offers nothing to change

- **WHEN** a participant who has sent their vote looks at their scoring screen
- **THEN** nothing there offers to alter a score or to send the vote again

#### Scenario: A draft vote is still editable

- **WHEN** a participant who has not yet sent their vote returns to the scoring screen
- **THEN** they can carry on scoring and send when they are ready

#### Scenario: Reloading does not change the answer

- **WHEN** a participant who has sent their vote reloads the scoring screen
- **THEN** it still shows the vote as sent, exactly as before the reload

### Requirement: The scoring screen is never a dead end

From the scoring screen a participant SHALL always be able to reach the other steps open to them — the dishes, and the results — whichever way they arrived at it. A participant SHALL NOT depend on the browser's own controls to leave a screen.

Moving between steps SHALL be theirs to choose: a participant who goes back to look at an earlier step SHALL be shown that step, and SHALL NOT be sent onward without asking.

#### Scenario: Moving on from scoring

- **WHEN** a participant is on the scoring screen
- **THEN** they can reach the dishes and the results from it

#### Scenario: Going back is respected

- **WHEN** a participant who has sent their vote goes back from the results to the scoring screen
- **THEN** they are shown the scoring screen, and are not returned to the results without asking

#### Scenario: Arriving directly is no different

- **WHEN** a participant opens the scoring screen's address directly
- **THEN** the same ways onward are open to them as if they had followed a link

