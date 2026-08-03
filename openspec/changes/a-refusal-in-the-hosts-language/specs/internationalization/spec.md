## MODIFIED Requirements

### Requirement: Every screen can be read in English or Spanish

Both frontends SHALL present all of their own interface text — labels, buttons, headings, helper and validation messages — in either English or Spanish. Text that originates outside the interface (contest and participant names, the assistant's replies, audit-log entries) is data, not interface text, and SHALL be left as it is.

Where the line falls is decided by who wrote the text and who it is for, not by which side of the wire it arrived on. A sentence the system writes for a host to read — why something they asked for could not be done — is interface text, and SHALL be presented in the chosen language even though it reaches the screen from the API. The contest data such a sentence names — the people, the things being judged on, the contest itself — is still data and SHALL be left as it is inside the translated sentence.

A screen SHALL NOT show a raw key, code, or internal identifier in place of text it cannot translate. Where a reason arrives that the screen has no wording for, it SHALL fall back to the sentence it was given rather than to nothing or to a key.

#### Scenario: A screen reads in the chosen language

- **WHEN** a visitor reads a screen with Spanish chosen
- **THEN** every piece of that screen's interface text is shown in Spanish

#### Scenario: Data is not translated

- **WHEN** a visitor reads, in Spanish, a screen that shows a contest named "Tapas Night"
- **THEN** the contest's name is still shown as "Tapas Night"

#### Scenario: A refusal is read in the chosen language

- **WHEN** a host with Spanish chosen is told their contest cannot go live yet
- **THEN** the reason it gives is shown in Spanish

#### Scenario: A refusal names its people and categories as they were written

- **WHEN** a host with Spanish chosen is refused because two of the things their contest is judged on are the same
- **THEN** the reason is shown in Spanish
- **AND** it names those two things exactly as the host named them

#### Scenario: A reason the screen has no wording for is still readable

- **WHEN** a host is refused for a reason this version of the screen has no wording for
- **THEN** they are shown the sentence the system gave, rather than a code or an empty space
