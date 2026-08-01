## ADDED Requirements

### Requirement: A host can take their contest's activity log away as a file
A host SHALL be able to take the recorded history of a contest they own away as a comma-separated file, carrying the same entries the screen shows and in the same order: what happened, how it was triggered, who acted, whether the host confirmed it, and when. The file SHALL be named after the contest it belongs to. Taking the log away SHALL be refused for a contest owned by a different host, and refused when no one is signed in — the same ownership rule as reading it on screen.

#### Scenario: The file carries what the screen shows
- **WHEN** a host who has published and then closed a contest takes its activity log away as a file
- **THEN** the file has a row for the contest being published and a row for it being closed
- **AND** each row carries how the action was triggered, who acted, and when

#### Scenario: The file is named after its contest
- **WHEN** a host takes the activity log of a contest away as a file
- **THEN** the file is named after that contest

#### Scenario: A host cannot take away another host's log
- **WHEN** a host tries to take away the activity log of a contest owned by a different host
- **THEN** it is refused as not allowed

#### Scenario: Taking the log away requires being signed in
- **WHEN** a contest's activity log is asked for as a file with no one signed in
- **THEN** it is refused as not signed in

#### Scenario: A value that could be read as a formula is made inert
- **WHEN** an entry's text begins with a character a spreadsheet would treat as the start of a formula
- **THEN** the file writes it so that a spreadsheet shows it as text rather than running it

#### Scenario: A value containing a separator or a quote survives the trip
- **WHEN** an entry's text contains a comma, a quotation mark, or a line break
- **THEN** the file quotes and escapes it so the row still reads as one row with its fields intact
