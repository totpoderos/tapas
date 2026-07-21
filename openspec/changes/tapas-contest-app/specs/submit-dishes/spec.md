## ADDED Requirements

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
When the contest's attribution gives a couple a single dish, either partner SHALL be able to submit it, and both SHALL see it as their dish.

#### Scenario: Partners share one dish, and either may submit it
- **WHEN** one partner of a couple submits their shared dish as "Tortilla"
- **THEN** the couple's single dish is recorded as "Tortilla"
- **AND** the other partner sees the same dish as theirs

### Requirement: Participants can see the dishes submitted so far
Anyone taking part in a contest SHALL be able to see the dishes submitted so far.

#### Scenario: Everyone taking part can see the dishes submitted so far
- **WHEN** a participant lists the contest's dishes after another has submitted "Patatas bravas"
- **THEN** "Patatas bravas" is among them
