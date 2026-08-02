## MODIFIED Requirements

### Requirement: A host can edit a draft's rules over the API
While a contest is still a draft, a host SHALL be able to change any of its rules through the API — its format, its scoring, who is taking part (adding or removing participants), and who is paired with whom — not only its name. A draft need not be complete or valid to be saved this way; only its name is required (the full rules are checked at publish). Editing SHALL only ever change the host's own draft, and SHALL be refused when no one is signed in.

There SHALL be no way through the API to bar a chosen pair from scoring each other independently of the format and the pairings: a contest's format and who is paired with whom are together the whole answer to who may not score whom.

#### Scenario: A host changes their draft's format, scoring and participants
- **WHEN** a host revises their draft's format, scoring categories and participants through the API
- **THEN** the stored draft reflects the revised rules
- **AND** the audit log records the change

#### Scenario: A host removes a participant from their draft
- **WHEN** a host revises their draft to remove one of its participants through the API
- **THEN** that participant is no longer part of the stored draft

#### Scenario: An unknown format is refused
- **WHEN** a host tries to revise their draft to a format that is not one of the three through the API
- **THEN** the revision is rejected because the format is not one the contest can have
- **AND** the stored draft is unchanged

#### Scenario: An edited draft still requires a name
- **WHEN** a host tries to revise their draft to have no name through the API
- **THEN** the revision is rejected because a name is required

#### Scenario: A host cannot edit another host's draft
- **WHEN** a host tries to revise a draft owned by a different host through the API
- **THEN** the revision is refused and the other host's draft is unchanged

#### Scenario: Editing a draft requires being signed in
- **WHEN** editing a draft is attempted through the API with no one signed in
- **THEN** the API refuses it as not authorized

### Requirement: A host can list all of their contests over the API
A host SHALL be able to list all of their own contests through the API in one place — drafts still being prepared and published contests alike — each marked with the state it is in (being prepared, live, closed, or revealed). Listing SHALL return only that host's contests.

Each listed contest SHALL also carry enough to be read without opening it:
- its rules in brief — its format, and how many scoring categories it has;
- its join code, once it has one;
- how its voting is progressing — how many people have claimed a place, how many are still scoring, and how many have sent their vote.

A contest still being prepared has no join code and no progress, and SHALL report none rather than zeroes, so that "nobody has voted yet" and "voting has not started" are told apart. Rules a draft has not been given yet SHALL likewise report none. Listing SHALL remain one request: reading the list SHALL NOT require a further request per contest.

#### Scenario: A host sees their contests across every state, each marked with its state
- **WHEN** a signed-in host who is preparing one contest, has a live contest, and has a revealed contest lists their contests
- **THEN** all three contests are listed
- **AND** the one being prepared is marked as being prepared, the live one as live, and the revealed one as revealed

#### Scenario: A contest whose voting has closed is listed as closed
- **WHEN** a signed-in host whose contest has had its voting closed lists their contests
- **THEN** that contest is marked as closed

#### Scenario: A live contest is listed with its progress
- **WHEN** a signed-in host lists their contests, and their live contest has eighteen people who claimed a place, of whom thirteen have sent their vote and five are still scoring
- **THEN** that contest is listed as having eighteen claimed, thirteen sent, and five still scoring

#### Scenario: A live contest is listed with its rules in brief and its join code
- **WHEN** a signed-in host lists their contests, and their live contest is one where everyone is on their own, across four categories
- **THEN** that contest is listed as one where everyone is on their own, with four categories
- **AND** it is listed with the join code participants use for it

#### Scenario: A contest being prepared reports no join code and no progress
- **WHEN** a signed-in host lists their contests and one of them is still being prepared
- **THEN** that contest is listed with no join code and no progress
- **AND** it is not listed as having nobody claimed and nobody voted

#### Scenario: Listing the whole list takes one request
- **WHEN** a signed-in host with several contests lists them
- **THEN** the progress and rules of every contest arrive with that one answer

#### Scenario: A host only sees their own contests
- **WHEN** a host with a contest, alongside a second host with their own contest, lists their contests through the API
- **THEN** only the requesting host's contest is listed

#### Scenario: Another host's progress is not disclosed
- **WHEN** a host lists their contests while a second host has a live contest with votes in it
- **THEN** nothing about the second host's contest, its join code or its progress is included

#### Scenario: Listing contests requires being signed in
- **WHEN** listing contests is attempted through the API with no one signed in
- **THEN** the API refuses it as not signed in

### Requirement: A host can read their own contest over the API
A host SHALL be able to read a contest they own through the API.

The read SHALL report the rules the contest is being played by, so that a host running it can see what it was published with without opening the draft it came from — which no longer exists. That includes its format, what the contest is judged on, the score band, and whether a score may be used more than once in a category. The format is the whole of what the contest says about who cooks and who may not score whom, so there is no second rule to report beside it.

The format SHALL be reported from what the contest recorded at publish, not reconstructed from the compiled constraint view. The compiler consumes the format into the set of dishes each judge may score, so the compiled view holds its consequence and not the format itself: where nobody has a partner, a contest where everyone is on their own and one where partners are kept apart compile to exactly the same thing. A contest that never recorded a format SHALL report that it does not say, rather than a guess.

#### Scenario: A host reads their own published contest through the API
- **WHEN** a host who has published a contest reads that contest through the API
- **THEN** the contest's details are returned

#### Scenario: The read reports the rules the contest is being played by
- **WHEN** a host reads a contest they published where everyone is on their own with partners kept apart, judged on three categories from one to ten with each score used once
- **THEN** the read reports that everyone is on their own with partners kept apart
- **AND** it reports the three categories, the band from one to ten, and that a score is used only once in a category

#### Scenario: A contest that never recorded its format says so
- **WHEN** a host reads a contest that has no format recorded
- **THEN** the read reports that the contest does not say what its format is
- **AND** it does not report a format inferred from the compiled view
