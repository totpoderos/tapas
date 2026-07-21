Feature: Revealing results
  A closed contest's winners stay hidden until the host reveals them. Reveal
  computes a winner per category and an overall winner, counting only votes
  that were actually sent — a judge who never sent their vote is not counted.
  A tie is shown as joint winners, not resolved automatically.

  Scenario: The host reveals results for a closed contest
    Given a closed contest where every judge has sent a vote
    When the host reveals it
    Then the results show a winner in every category and an overall winner

  Scenario: A tie is shown as joint winners
    Given a closed contest where two dishes are tied for the top score in a category
    When the host reveals it
    Then both tied dishes are listed as winners of that category

  Scenario: An unsent vote does not count toward the results
    Given a closed contest where one judge never sent their vote
    When the host reveals it
    Then that judge's scores are not reflected in the results

  Scenario: Reveal is refused before the contest has closed
    Given a live contest that has not yet closed
    When the host tries to reveal it
    Then reveal is refused because the contest has not closed

  Scenario: Reveal cannot happen twice
    Given a contest that has already been revealed
    When the host tries to reveal it again
    Then reveal is refused because it has already been revealed

  Scenario: Results are hidden until reveal
    Given a closed contest that has not yet been revealed
    When the host asks for the results
    Then the results are refused because the contest has not been revealed

  Scenario: A host cannot reveal another host's contest
    Given a closed contest owned by one host
    When a different host tries to reveal it
    Then reveal is refused as not allowed

  Scenario: A contest reveals automatically once its scheduled reveal time arrives
    Given a closed contest scheduled to reveal at a set time, and that time has passed
    When anyone checks the contest afterwards
    Then the contest is revealed
