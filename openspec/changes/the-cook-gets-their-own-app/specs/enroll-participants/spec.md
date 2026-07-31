## MODIFIED Requirements

### Requirement: A contest publishes with a roster of places

Publishing a contest SHALL create one open place per participant the host listed, keyed by the participant id the compiled constraint view uses, so a claimed place maps directly onto the scoring rules.

Looking up a live contest by its join code SHALL return the contest's whole roster — every place, named, each marked as still open or already taken — rather than only the places still open. Only a place still open SHALL be claimable; a place already taken is shown so that a person can see the roster is real and can tell "your name is gone" apart from "this is the wrong contest".

This means somebody holding a join code learns who has already joined. That is accepted: the names are the ones the host listed and are known to everyone in the room, no other detail about a person is attached, and the code is high-entropy and stops working when the contest closes.

#### Scenario: The whole roster is shown for a valid code

- **WHEN** someone looks up a live contest by its join code
- **THEN** every place on the roster is offered, each marked as open or as taken

#### Scenario: A taken place is not offered as claimable

- **WHEN** someone looks up a live contest where a place has already been claimed
- **THEN** that place is shown as taken and is not offered to be claimed

#### Scenario: A contest with no place left still names its roster

- **WHEN** someone looks up a live contest where every place has been claimed
- **THEN** the whole roster is returned, with every place marked as taken

#### Scenario: An unknown join code is refused

- **WHEN** someone looks up a contest by a code that no contest has
- **THEN** the lookup is refused because the code is unknown
