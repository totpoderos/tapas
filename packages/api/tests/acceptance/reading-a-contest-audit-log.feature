Feature: Reading a contest's audit log
  Every action on a contest is recorded — who did it, when, and how it was
  triggered — as a projection of the events the contest emits. A host can read
  the full history of their own contest, and a destructive action the host
  approved through the assistant is recorded as host-confirmed. A host may only
  read the log of a contest they own, and reading is refused when no one is
  signed in.

  The same history can be taken away as a comma-separated file, behind the same
  ownership rule and from the same read — so what a host can look at and what
  they can keep cannot come to differ. A contest's name is the host's own text,
  so the file quotes and escapes what it carries rather than trusting it.

  Scenario: The history of a contest spans its whole life
    Given a signed-in host who has published a contest and then closed it
    When that host reads the contest's audit log
    Then the log records that the contest was published
    And the log records that the contest was closed
    And each entry names who acted and when

  Scenario: A destructive action approved through the assistant is recorded as host-confirmed
    Given a signed-in host with a running contest
    And that host closes it through the assistant, confirming when asked
    When that host reads the contest's audit log
    Then the closing is recorded as confirmed by the host

  Scenario: A host cannot read another host's audit log
    Given a signed-in host who has published a contest
    And a second signed-in host
    When the second host tries to read the first host's contest audit log
    Then it is refused as not allowed

  Scenario: Reading the audit log requires being signed in
    Given a contest exists
    And no one is signed in
    When its audit log is requested
    Then it is refused as not signed in

  Scenario: A host takes the log away as a file
    Given a signed-in host who has published a contest and then closed it
    When that host asks for the audit log as a file
    Then the file carries a row for the publishing and a row for the closing
    And each row carries how it was triggered, who acted, and when
    And the file is named after the contest

  Scenario: A host cannot take away another host's log as a file
    Given a signed-in host who has published a contest
    And a second signed-in host
    When the second host asks for the first host's log as a file
    Then it is refused as not allowed
    And no part of that contest's history is written

  Scenario: Taking the log away requires being signed in
    Given a contest exists
    And no one is signed in
    When its audit log is asked for as a file
    Then it is refused as not signed in

  Scenario: The file and the screen cannot drift apart
    Given a signed-in host who has published a contest and then closed it
    When that host reads the log on screen and asks for it as a file
    Then the file has exactly one row per recorded action
    And the rows say the same actions, in the same order, as the screen
