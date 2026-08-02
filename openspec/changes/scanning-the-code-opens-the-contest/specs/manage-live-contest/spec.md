## MODIFIED Requirements

### Requirement: A host can hand the join code over by scanning
A host running a live contest SHALL be able to show its join code as a scannable code, as well as copy it as text, so that people at the venue can join without the code being read out.

The scannable code SHALL carry the contest's join link — the address that opens the participant app already carrying that join code — so that scanning it lands on the joining screen with the code already entered, and the person scanning is asked only to choose their name. It SHALL carry nothing else about the contest, its host, or its participants.

The scannable code itself SHALL be generated where it is shown rather than fetched as an image, and SHALL carry the join code in writing beside it, still copyable, so that a person who cannot scan it — no camera, a scan that will not read, joining from a laptop — can still be told the code and type it.

When read aloud, the scannable code SHALL be named by the join code it carries and not by the link, because which code this is, is what a person listening is being handed.

#### Scenario: The host shows the join code as a scannable code
- **WHEN** a host of a live contest asks to show its join code as a scannable code
- **THEN** a scannable code for that contest is shown
- **AND** the join code is still readable in writing beside it

#### Scenario: Scanning the code opens the contest ready to join
- **WHEN** somebody at the venue scans the code a host is showing
- **THEN** the participant app opens on its joining screen
- **AND** the contest's join code is already entered, so they are asked only which name is theirs

#### Scenario: The scannable code says nothing else about the contest
- **WHEN** a scannable code is shown for a contest's join code
- **THEN** it carries the participant address and that join code only
- **AND** it carries nothing about the contest, its host, or its participants

#### Scenario: The scannable code is named by the code it hands over
- **WHEN** a host shows the scannable code and it is read aloud
- **THEN** it is named by the contest's join code
- **AND** it is not read out as an address

#### Scenario: A contest with no join code offers no scannable code
- **WHEN** a host opens a contest still being prepared
- **THEN** no scannable code is offered, because no join code has been issued

#### Scenario: Copying the code remains available
- **WHEN** a host of a live contest asks to copy its join code
- **THEN** the join code is copied, and the host is told it was
