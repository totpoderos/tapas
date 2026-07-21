Feature: Extracting a contest draft from a chat message
  A host can describe a contest in a free-form message instead of filling in
  a form. The assistant extracts what it can into a draft, tags every field
  with where it came from, and lists what it could not determine so the host
  can fill in the rest. The assistant may never guess a high-stakes field on
  the host's behalf — attribution, anti-bias, scoring range and uniqueness,
  and participants must come from the host, not a default.

  Scenario: A complete message extracts a full draft with no clarifications needed
    Given a host message that fully describes a contest
    When the host asks the assistant to extract a draft from it
    Then the extracted draft includes every field, tagged with its source
    And there are no clarifications

  Scenario: A partial message extracts what it can and asks for the rest
    Given a host message that leaves out the participants
    When the host asks the assistant to extract a draft from it
    Then the extracted draft includes what could be determined
    And the clarifications list asks for the participants

  Scenario: The assistant may not default a high-stakes field
    Given an assistant response that defaults the attribution field without the host having said so
    When the draft is extracted
    Then the attribution field is dropped from the draft
    And a clarification asks the host to specify it

  Scenario: Extraction requires being signed in
    Given no one is signed in
    When a draft extraction is attempted
    Then it is refused as not signed in
