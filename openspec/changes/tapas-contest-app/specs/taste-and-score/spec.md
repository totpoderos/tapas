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
