Feature: A participant sees the results revealed
  Once the host reveals a contest, participants see the winners — the overall
  winner and the winner of each category, over a leaderboard. Until then the
  results are held back. The reveal appears the moment the host triggers it,
  without reloading. It is mobile-first, accessible (WCAG 2.1 AA), and honours
  reduced-motion.

  Scenario: Results are held back until the host reveals them
    Given a participant in a contest whose voting has closed but is not revealed
    When they open the results
    Then they are told the results aren't out yet

  Scenario: A participant sees the winners once the contest is revealed
    Given a participant in a contest the host has revealed
    When they open the results
    Then they see the overall winner and the winner of each category

  Scenario: The reveal appears when the host triggers it, without reloading
    Given a participant waiting on a contest that has closed but is not revealed
    When the host reveals the contest
    Then the results appear for the participant without them reloading

  Scenario: The reveal is keyboard-operable and accessible
    Given a participant viewing a revealed contest's results
    Then the screen has no accessibility violations
