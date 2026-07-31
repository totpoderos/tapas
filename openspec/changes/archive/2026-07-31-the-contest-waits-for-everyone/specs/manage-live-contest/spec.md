## REMOVED Requirements

### Requirement: A contest can close on its own once everyone who joined has voted

**Reason**: The rule was wrong, and its name carried the error. "Everyone who
joined" meant everyone who had *claimed a place so far* — early in an evening
that is one person, so the first participant to send closed the contest for the
whole room. A closed contest refuses scores and dishes, so everybody still to
arrive was locked out with their drafts stranded and no way back. `all_sent` is
the default close rule, so this reached every contest published without an
explicit one.

**Migration**: Replaced by "A contest can close on its own once every place has
voted", below. Renamed rather than modified in place because the old title named
the defect: a requirement still called "everyone who joined" would be read back
as the claimed set by the next person to touch it. No data migration — a contest
already closed in error stays closed, since closing is one-way and reopening is
not a capability this system has.

## ADDED Requirements

### Requirement: A contest can close on its own once every place has voted

A contest configured to close once everyone has sent their vote SHALL close
automatically the moment **every place on its roster** has sent a vote. A place
nobody has claimed SHALL hold the contest open.

Where somebody never arrives, the contest SHALL stay open and the host SHALL
close it themselves. The system cannot tell a participant who has not arrived yet
from one who is not coming; the host is in the room and can.

#### Scenario: A contest closes on its own once every place has voted

- **WHEN** every place on the roster of a contest set to close once everyone has voted has sent a vote
- **THEN** the contest is closed

#### Scenario: A contest does not close early while someone has not yet voted

- **WHEN** one participant who claimed a place has not yet sent their vote, in a contest set to close once everyone has voted
- **THEN** the contest is still live

#### Scenario: A contest does not close while a place is still unclaimed

- **WHEN** everyone who has claimed a place has sent their vote, but a place on the roster is still unclaimed
- **THEN** the contest is still live, so the people yet to arrive can still take part

#### Scenario: The host closes a contest somebody never arrived for

- **WHEN** a place is never claimed and the host closes the contest themselves
- **THEN** the contest is closed
