## ADDED Requirements

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
