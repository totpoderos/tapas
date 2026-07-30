Feature: A host takes a contest's history away as a file
  What happened to a contest is the host's record, not only something to look at
  on a screen. They can take it away as a comma-separated file and open it in a
  spreadsheet — to keep alongside the night's photos, to answer a question weeks
  later, or to hand to somebody who was not there.

  The file carries what the screen carries, in the same order: what happened, how
  it was triggered, who acted, whether the host confirmed it, and when. It is the
  same projection, so the two cannot drift.

  Whose log it is matters as much on the way out as on the way in: the file is
  refused for a contest that is not the host's, and refused when nobody is signed
  in — the same rule as reading it on screen, decided in the same place.

  Some of what the log records was written by an assistant, so some of it is text
  the app did not choose. A spreadsheet treats certain leading characters as the
  start of a formula, so the file is written to be read as text, never run.

  Scenario: A host takes the log away from the screen they were reading it on
    Given a signed-in host looking at the activity log of a contest they have closed
    When they ask for the log as a file
    Then the file is offered to them
    And it is named after that contest

  Scenario: The file says what the screen says
    Given a signed-in host who takes away the log of a contest they published and closed
    Then the file has a row for the publishing and a row for the closing
    And each row says how it was triggered, who acted, and when
    And the rows are in the order the screen shows them

  Scenario: The file records what the host confirmed
    Given a signed-in host who takes away the log of a contest whose voting they closed
    Then the row for the closing says the host confirmed it
    And the rows that needed no confirmation do not

  Scenario: The file is not another host's to take
    Given a signed-in host asking for the file of a contest they do not own
    Then it is refused as not theirs
    And no part of that contest's history is written

  Scenario: Taking the log away requires being signed in
    Given the file of a contest is asked for with nobody signed in
    Then it is refused as not signed in

  Scenario: A refusal is told on the screen, not by replacing it
    Given a signed-in host whose request for the file is refused
    Then the panel says it was refused
    And the log they were reading is still there

  Scenario: Text a spreadsheet would run is written as text
    Given a recorded action whose text begins the way a formula does
    When a host takes the log away
    Then the file writes that text so a spreadsheet shows it rather than runs it

  Scenario: Text containing a separator or a quotation mark survives
    Given a recorded action whose text contains a comma, a quotation mark, or a line break
    When a host takes the log away
    Then the row still reads as one row, with that text intact

  Scenario: Taking the log away is keyboard-operable and free of accessibility violations
    Given a signed-in host looking at an activity log
    Then the way to take it away can be reached and used without a mouse, showing where focus is
    And the screen has no accessibility violations

  Scenario: The way to take the log away reads in Spanish
    Given a signed-in host looking at an activity log
    When they switch the language to Spanish
    Then the way to take the log away is offered in Spanish
