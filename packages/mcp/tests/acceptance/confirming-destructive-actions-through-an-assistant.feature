Feature: Confirming destructive actions through a connected assistant
  Some actions the assistant can take are destructive — closing a contest,
  publishing, sending reminders — and must not happen by accident or on the
  say-so of a confused model. Before the assistant carries out a destructive
  action, it must obtain an explicit confirmation for that exact action and
  present it back; only then is the action carried out. A confirmation is tied
  to the one action it was given for and cannot be reused to carry out a
  different action. This is enforced at the tool surface itself, independently
  of any confirmation the host app also shows.

  Scenario: A destructive action is not carried out until it is confirmed
    Given a host with a personal access token and a running contest
    When the assistant is asked to close the contest without a confirmation
    Then the contest is not closed
    And the assistant is told the action needs confirming

  Scenario: A confirmed destructive action is carried out
    Given a host who has been told how to confirm closing their running contest
    When the assistant closes the contest with that confirmation
    Then the contest is closed

  Scenario: A confirmation for one action does not authorize another
    Given a host with two running contests and a confirmation to close the first
    When the assistant tries to close the second contest with the first's confirmation
    Then the second contest is not closed
    And the assistant is told the action needs confirming
