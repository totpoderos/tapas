Feature: Reading a contest's audit log
  Every action on a contest is recorded — who did it, when, and how it was
  triggered — as a projection of the events the contest emits. A host can read
  the full history of their own contest, and a destructive action the host
  approved through the assistant is recorded as host-confirmed. A host may only
  read the log of a contest they own, and reading is refused when no one is
  signed in.

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
