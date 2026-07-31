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

  Scenario: How the voting stands says how many are in, out of how many
    Given a contest where one participant has sent their vote and one has not
    When a participant who took part reads how the voting stands
    Then they are told how many votes are in, out of how many are expected

  Scenario: How the voting stands names who has still to vote
    Given a contest where one participant has sent their vote and one has not
    When a participant who took part reads how the voting stands
    Then the one who has not sent is named as still to vote
    And the one who has sent is marked as in

  Scenario: How far someone has got is not reported
    Given a contest where one participant has scored some dishes but not sent
    When a participant who took part reads how the voting stands
    Then nothing in the answer says what has been scored, or how much

  Scenario: How the voting stands is refused to anyone who did not take part
    Given a contest in play
    When how the voting stands is read with no participant token
    Then it is refused as not signed in

  Scenario: How the voting stands carries nothing about another contest
    Given a participant who took part in one of two contests in play
    When they ask how the voting stands in the contest they had no part in
    Then it is refused, and names nobody from it
