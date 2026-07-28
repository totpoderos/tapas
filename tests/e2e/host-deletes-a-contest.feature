Feature: A host deletes a contest
  A contest can be got rid of at any point in its life. Because there is no undo,
  the host is always asked first, and once people have taken part they must
  reproduce the contest's name before it will go. Someone still using the contest
  when it disappears is told plainly that it is gone. The screens are
  keyboard-operable and meet accessibility standards (WCAG 2.1 AA).

  Scenario: A host deletes a contest nobody has joined
    Given a host with a contest nobody has joined
    When they delete it and confirm
    Then it is gone from their contests

  Scenario: Deleting a contest people have joined demands its name
    Given a host viewing a running contest people have joined
    When they choose to delete it
    Then they are asked to reproduce its name, and it is not deleted until they do

  Scenario: A participant using the contest is told it is gone
    Given a participant taking part in a running contest
    When the host deletes that contest
    Then the participant is told the contest is gone

  Scenario: Backing out of the confirmation destroys nothing
    Given a host with a contest nobody has joined
    When they choose to delete it but cancel
    Then the contest is still there

  Scenario: The confirmation is keyboard-operable and accessible
    Given a host viewing a running contest people have joined
    Then the confirmation has no accessibility violations
