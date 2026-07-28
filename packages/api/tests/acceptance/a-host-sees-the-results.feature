Feature: A host sees the results
  The host runs the contest but watches the ending like everyone else. Once they
  have revealed it, they can read the results of a contest they own: the overall
  winner and each category's winner, by dish name, over a leaderboard. The
  results are held back until the contest is revealed, a host only ever reads
  their own, and what they read names the same winners, in the same order, as
  the participants see.

  Scenario: A host reads the winners of their revealed contest
    Given a contest that has been fully voted, closed, and revealed
    When its host reads the results
    Then they see the overall winner by name
    And they see the winner of each category
    And they see every dish's total

  Scenario: A tie is shown as joint winners
    Given a revealed contest in which two dishes finished level at the top
    When its host reads the results
    Then both dishes are named as winners

  Scenario: The results are held back until the contest is revealed
    Given a contest that has been fully voted and closed but not revealed
    When its host reads the results
    Then they are told the results are not out yet

  Scenario: A host cannot read another host's results
    Given a revealed contest belonging to another host
    When a host reads its results
    Then it is refused as not allowed

  Scenario: Reading the results requires being signed in
    Given a revealed contest
    When the results are read with nobody signed in
    Then it is refused as not signed in

  Scenario: The host and the participants see the same results
    Given a contest that has been fully voted, closed, and revealed
    When its host and a participant who took part each read the results
    Then the same dishes are named as winners
    And the leaderboard is in the same order for both
