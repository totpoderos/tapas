Feature: Checking the live tally
  While a contest is running, the host can check how many participants have
  claimed a place and how many have scored in draft or sent their vote — a
  live progress view, not the results themselves.

  Scenario: The host checks the tally of a contest in progress
    Given a contest where some participants have claimed a place, some have drafted scores, and one has sent a vote
    When the host checks the tally
    Then the tally shows how many have claimed, how many are still drafting, and how many have sent

  Scenario: A host cannot check another host's tally
    Given a contest owned by one host
    When a different host tries to check its tally
    Then checking is refused as not allowed
