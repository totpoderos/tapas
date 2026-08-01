## ADDED Requirements

### Requirement: The publish checklist says whether enough people are taking part
The checklist SHALL say whether a contest being prepared has enough people to go live, because a contest with nobody taking part, and a contest with exactly one person, are both refused when published. It SHALL NOT report a contest as ready while either is true. Where only one person is taking part, the checklist SHALL say why a second is needed rather than only that one is.

The checklist remains a prediction from the draft's own content. Whether every judge can score something depends on the attribution, the anti-bias rule, the pairings and the barred pairs together, and stays the server's answer — only what is certain from the count alone is said here.

#### Scenario: A contest nobody is taking part in is not ready
- **WHEN** a signed-in host is preparing a contest that nobody is taking part in
- **THEN** the checklist says nobody is taking part yet
- **AND** it does not say the contest is ready to publish

#### Scenario: A contest one person is taking part in is not ready, and says why
- **WHEN** a signed-in host is preparing a contest that exactly one person is taking part in
- **THEN** the checklist says at least two people are needed
- **AND** it says that is because nobody may score their own dish
- **AND** it does not say the contest is ready to publish

#### Scenario: The people are counted once there are enough of them
- **WHEN** a signed-in host is preparing a contest that two or more people are taking part in
- **THEN** the checklist counts the people taking part
- **AND** it does not report the people as something still missing

#### Scenario: A contest reached from the form that starts it does not claim to be ready
- **WHEN** a signed-in host names a new contest and goes on to its participants and pairing, where nobody has been added yet
- **THEN** the checklist says nobody is taking part yet
- **AND** it does not say the contest is ready to publish
