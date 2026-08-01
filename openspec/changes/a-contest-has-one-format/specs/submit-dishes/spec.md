## MODIFIED Requirements

### Requirement: Partners who share a dish share one submission
Where the contest's format is that couples cook together, a couple SHALL have one dish between them: either partner SHALL be able to submit it, and both SHALL see it as their dish. Under the other two formats every participant cooks their own dish, and a partner SHALL NOT be able to submit on their behalf.

#### Scenario: Partners share one dish, and either may submit it
- **WHEN** one partner of a couple submits their shared dish as "Tortilla", in a contest where couples cook together
- **THEN** the couple's single dish is recorded as "Tortilla"
- **AND** the other partner sees the same dish as theirs

#### Scenario: Partners kept apart still cook one dish each
- **WHEN** one partner of a couple submits their dish as "Tortilla", in a contest where everyone is on their own with partners kept apart
- **THEN** that dish is recorded as theirs alone
- **AND** the other partner still has no dish of their own
