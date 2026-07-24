Feature: A participant sees the results
  Once the host reveals a contest, a participant can read the results: the
  overall winner and each category's winner, by dish name, over a leaderboard.
  The results are held back until the contest is revealed, and only a participant
  who has claimed a place may read them.

  Scenario: A participant reads the winners of a revealed contest
    Given a contest that has been fully voted, closed, and revealed
    When a participant who took part reads the results
    Then they see the overall winner by name
    And they see the winner of each category

  Scenario: The results are held back until the contest is revealed
    Given a contest that has been fully voted and closed but not revealed
    When a participant who took part reads the results
    Then they are told the results are not out yet

  Scenario: Reading the results requires having claimed a place
    Given a revealed contest
    When the results are read with no participant token
    Then it is refused as not signed in
