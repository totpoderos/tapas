Feature: A host reviews a contest's activity log
  From their contest list a host can open a published contest's activity log and
  see everything that has happened to it — each action with who did it, when, and
  how it was triggered — and filter the list by how actions were triggered. The
  log is fully keyboard-operable and meets accessibility standards (WCAG 2.1 AA).

  Scenario: A host opens a contest's activity log
    Given a signed-in host with a published contest
    When they open that contest's activity log from their list
    Then they see the actions taken on it, each with who and when

  Scenario: A host filters the log by how actions were triggered
    Given a host viewing the activity log of a contest with actions from more than one source
    When they filter to a single source
    Then only actions from that source are shown

  Scenario: The activity log is keyboard-operable and accessible
    Given a signed-in host viewing a contest's activity log
    When they operate the source filter using only the keyboard
    Then the screen has no accessibility violations
