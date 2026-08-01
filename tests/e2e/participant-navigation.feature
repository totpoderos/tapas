Feature: A participant is never stranded
  Moving around is not always forwards. A participant steps back to check what
  they wrote, reloads when a phone wakes up, or opens an address they were sent.
  However they arrive, there is a way on to the other steps — and a vote they
  have already sent still reads as sent, rather than offering a ballot they
  cannot use. Where they go is theirs to choose: going back shows them the step
  they went back to, not the one they came from.

  Scenario: Every step offers the others
    Given a participant who has joined a contest
    When they open the scoring screen
    Then they can reach the dishes and the results from it

  Scenario: Waiting for the results is not being stuck
    Given a participant who has joined a contest
    When they open the results before the host has revealed them
    Then they can still reach the dishes and their scoring

  Scenario: Going back after voting shows the vote as sent
    Given a participant who has sent their vote
    When they open the results and then go back
    Then they are shown that their vote is in, and can reach the results again

  Scenario: Reloading does not lose the way onward
    Given a participant who has sent their vote
    When they reload the scoring screen
    Then their vote still reads as sent, and the results are still reachable

  Scenario: Arriving by the address alone is no different
    Given a participant who has joined a contest
    When they open the scoring screen's address directly
    Then they can reach the dishes and the results from it

  Scenario: The ways onward stay in reach on a long screen
    Given a participant who has joined a contest
    When they scroll to the bottom of a screen longer than their phone
    Then the ways onward are still where they were
    And the screen's own action is still reachable

  Scenario: The ways onward say which step you are on
    Given a participant who has joined a contest
    When they open the scoring screen
    Then the scoring step is marked as the one they are on
    And the mark is not made by colour alone

  Scenario: The ways onward say there is scoring to do
    Given a participant who has joined a contest and has dishes to score
    When they open the dishes screen
    Then the scoring step is marked as outstanding, in words as well as in colour

  Scenario: The ways onward say the vote is in
    Given a participant who has sent their vote
    When they open the dishes screen
    Then the scoring step is marked as sent, in words as well as in colour

  Scenario: A screen with nowhere to go offers no ways onward
    Given a participant whose contest has been deleted
    When they open a screen that needs them to have joined
    Then there are no ways onward, only the way out
