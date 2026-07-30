## MODIFIED Requirements

### Requirement: A host can list all of their contests over the API
A host SHALL be able to list all of their own contests through the API in one place — drafts still being prepared and published contests alike — each marked with the state it is in (being prepared, live, closed, or revealed). Listing SHALL return only that host's contests.

Each listed contest SHALL also carry enough to be read without opening it:
- its rules in brief — how dishes are attributed, and how many scoring categories it has;
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
- **WHEN** a signed-in host lists their contests, and their live contest scores each person on their own across four categories
- **THEN** that contest is listed as scoring each person on their own, with four categories
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
