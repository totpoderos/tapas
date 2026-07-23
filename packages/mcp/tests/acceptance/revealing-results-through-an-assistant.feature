Feature: Revealing results through a connected assistant
  Once a contest has closed, the host can reveal it and read its results — both
  through the assistant. Revealing announces the winners and cannot be undone,
  so it is treated as a destructive action and needs confirmation; reading the
  results afterwards is an ordinary read.

  Scenario: Revealing a contest must be confirmed
    Given a host with a closed contest ready to reveal
    When the assistant is asked to reveal it without a confirmation
    Then the contest is not revealed
    And the assistant is told the action needs confirming

  Scenario: A confirmed reveal reveals the contest
    Given a host with a closed contest and the confirmation to reveal it
    When the assistant reveals the contest with that confirmation
    Then the contest is revealed

  Scenario: The assistant reads the results of a revealed contest
    Given a host with a revealed contest
    When the assistant is asked to read its results
    Then the results are returned
