Feature: A host runs their live contest
  From a live contest a host watches it progress — how many have joined, are
  still scoring, and have sent their vote — and drives it: closing voting when
  they are ready, then revealing the results. Closing and revealing cannot be
  undone, so each is confirmed first. The screen is keyboard-operable and meets
  accessibility standards (WCAG 2.1 AA).

  Scenario: A host watches the tally of a running contest
    Given a host with a live contest that participants have joined
    When they open the contest
    Then they see how many have joined, are still scoring, and have sent their vote

  Scenario: A host closes voting on a running contest
    Given a host viewing their live contest
    When they close it and confirm
    Then the contest is closed

  Scenario: A host reveals a closed contest, and participants can see the results
    Given a host viewing their closed contest
    When they reveal it and confirm
    Then the contest is revealed

  Scenario: Closing is confirmed before it runs
    Given a host viewing their live contest
    When they choose to close but cancel the confirmation
    Then the contest is still live

  Scenario: The control screen is keyboard-operable and accessible
    Given a host viewing their live contest
    Then the screen has no accessibility violations
