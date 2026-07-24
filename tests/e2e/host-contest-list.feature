Feature: A host reviews their contests at a glance
  When a host opens the app they land on their contest list: every contest they
  own, each shown with a clear status they can read by word and shape, not colour
  alone. From here they can start a new contest. A host with no contests yet is
  invited to create their first. The list is fully keyboard-operable and meets
  accessibility standards (WCAG 2.1 AA).

  Scenario: A host sees their contests with a clear status on each
    Given a signed-in host who has a draft contest, a live contest, and a revealed contest
    When they open the host app
    Then they see all three contests listed
    And each contest shows its status as a word: Draft, Live, or Revealed

  Scenario: A host with no contests is invited to create their first
    Given a signed-in host with no contests
    When they open the host app
    Then they are invited to create their first contest

  Scenario: A host can start a new contest from the list
    Given a signed-in host who has at least one contest
    When they open the host app
    Then a way to start a new contest is offered

  Scenario: The contest list is keyboard-operable and accessible
    Given a signed-in host who has a draft contest, a live contest, and a revealed contest
    When they open the host app and move through the list using only the keyboard
    Then the screen has no accessibility violations
    And they can reach the control to start a new contest
