# submit-dishes Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
### Requirement: A cook submits their own dish
During a live contest a cook SHALL register the dish they brought — a name, and optionally a description. The dish is their place in the contest (their materialized dish slot); a cook can only submit or revise that one, not another participant's. Submitting a name is required.

#### Scenario: A cook submits their dish
- **WHEN** a participant who has claimed a place submits a dish named "Patatas bravas"
- **THEN** their dish is recorded as "Patatas bravas"

#### Scenario: A cook revises their dish rather than adding a second
- **WHEN** a participant who has already submitted a dish submits it again with a new name
- **THEN** their dish reflects the new name
- **AND** they still have only one dish

#### Scenario: A dish must have a name
- **WHEN** a participant submits a dish with no name
- **THEN** submitting is refused because a name is required

### Requirement: Submitting a dish requires having claimed a place
Only a participant who has claimed a place SHALL be able to submit a dish.

#### Scenario: Submitting a dish requires having claimed a place
- **WHEN** a dish is submitted with no participant token
- **THEN** submitting is refused as not signed in

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

### Requirement: Participants can see the dishes submitted so far
Anyone taking part in a contest SHALL be able to see the dishes submitted so far.

#### Scenario: Everyone taking part can see the dishes submitted so far
- **WHEN** a participant lists the contest's dishes after another has submitted "Patatas bravas"
- **THEN** "Patatas bravas" is among them

