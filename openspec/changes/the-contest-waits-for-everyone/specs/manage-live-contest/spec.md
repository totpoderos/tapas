## MODIFIED Requirements

### Requirement: A contest can close on its own once everyone has voted

A contest configured to close once everyone has sent their vote SHALL close
automatically the moment **every place on its roster** has sent a vote. A place
nobody has claimed SHALL hold the contest open.

This reverses the previous rule, which asked only about places already claimed.
That rule closed the contest as soon as the first participant sent — early in an
evening the claimed set is one person — and a closed contest refuses scores and
dishes, so everyone still voting was locked out with no way back.

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
