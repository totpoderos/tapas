Feature: A host edits a draft and takes it live
  Before a contest goes live, a host opens the draft they have been preparing,
  changes any of its rules, and publishes it — turning it into a live contest
  that participants can join. A draft that is not yet complete cannot be taken
  live, and the host is told why. The screen is fully keyboard-operable and meets
  accessibility standards (WCAG 2.1 AA).

  Scenario: A host opens a draft to edit its rules
    Given a signed-in host with a draft they have configured
    When they open that draft from their contest list
    Then they can edit its name and the rules they chose

  Scenario: A host edits a draft's rules and the change persists
    Given a signed-in host editing a draft named "Summer Tapas"
    When they rename it to "Summer Tapas Final" and remove a participant, then save
    Then reopening the draft shows the new name and the participant gone

  Scenario: A host publishes a complete draft and it goes live
    Given a signed-in host reviewing a complete draft
    When they publish it
    Then it becomes a live contest
    And it appears in their contest list marked as live

  Scenario: An incomplete draft cannot be taken live
    Given a signed-in host reviewing a draft that has no scoring rules yet
    When they try to publish it
    Then they are told it cannot go live yet because it is incomplete
    And it is still a draft, not live

  Scenario: The edit screen is keyboard-operable and accessible
    Given a signed-in host reviewing a complete draft
    When they publish it using only the keyboard
    Then the screen has no accessibility violations
    And it becomes a live contest
