Feature: A host sees the results on their own screen
  The host runs the contest but watches the ending like everyone else. Once they
  have revealed it, they reach the results from the contest and see the winners
  named — the same winners, in the same order, that the participants are looking
  at on their phones. The screen is keyboard-operable and meets accessibility
  standards (WCAG 2.1 AA).

  Scenario: A host reaches the results from the contest and sees the winners
    Given a host who has closed and revealed their contest
    When they follow the way through to the results
    Then they see the winning dish named, and the leaderboard

  Scenario: The host and a participant are shown the same winners
    Given a revealed contest that a participant took part in
    When the host and the participant each look at the results
    Then the same dish is named the winner, and the leaderboard reads the same order

  Scenario: The results screen holds nothing before the reveal
    Given a host whose contest has been closed but not revealed
    When they open the results directly
    Then they are told the results are not out yet, and no leaderboard is shown

  Scenario: The results screen is keyboard-operable and accessible
    Given a host viewing the results of their revealed contest
    Then the screen has no accessibility violations
