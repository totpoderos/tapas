Feature: Merging a host's reply into a partial contest draft

  A host's first message often leaves gaps, so the assistant asks for what
  is missing. The host's next reply must be merged into the same draft: it
  should fill in what the reply answers, keep whatever was already known
  even if the reply does not repeat it, and keep asking about anything
  still outstanding. As in extraction, the assistant may never guess a
  high-stakes field on the host's behalf.

  Scenario: A reply that answers every open clarification completes the draft
    Given a partial draft missing the participants, with a clarification asking for them
    When the host replies naming the participants
    Then the merged draft includes the participants
    And there are no clarifications left

  Scenario: A reply that answers only part of what's missing keeps asking for the rest
    Given a partial draft missing both the participants and the scoring rules
    When the host replies naming only the participants
    Then the merged draft includes the participants
    And the clarifications list still asks for the scoring rules

  Scenario: Fields already known are kept even when the reply doesn't repeat them
    Given a partial draft with the contest name already set
    When the host replies about an unrelated field
    Then the merged draft still includes the contest name

  Scenario: The assistant may not default a high-stakes field while merging
    Given a merge attempt that defaults the attribution field without the host having said so
    When the reply is merged
    Then the attribution field is dropped from the draft
    And a clarification asks the host to specify it

  Scenario: Merging a reply requires being signed in
    Given no one is signed in
    When a draft merge is attempted
    Then it is refused as not signed in
