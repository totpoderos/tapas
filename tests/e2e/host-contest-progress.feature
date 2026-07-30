Feature: A host sees how each contest is going without opening it
  A host running several contests should not have to open each one to find out
  where it stands. Their list says it: how far along the voting is, what the
  contest is judged on, and the code people join with.

  What a contest cannot yet have, it does not pretend to have. A contest still
  being prepared has no code and no votes, and says so — "not published" is a
  different thing from "nobody has voted", and a host reading the list quickly
  must not have to tell them apart by guessing.

  Voting that has not started yet is also its own answer: a contest nobody has
  joined says nobody has joined, rather than showing an empty bar that looks like
  a contest going badly.

  Scenario: A live contest shows how far along its voting is
    Given a signed-in host with a live contest that four people have joined
    And two of them have sent their votes
    When they open their contests
    Then that contest shows two of four votes sent
    And it shows how far along it is

  Scenario: A live contest nobody has joined says so
    Given a signed-in host with a live contest nobody has joined
    When they open their contests
    Then that contest says nobody has joined yet
    And it does not show votes sent

  Scenario: A live contest shows what it is judged on, and the code to join it
    Given a signed-in host with a live contest scored per person on three categories
    When they open their contests
    Then that contest shows it is scored per person
    And it shows it has three categories
    And it shows the code people join it with

  Scenario: A contest being prepared has no code and no votes
    Given a signed-in host with a contest still being prepared
    When they open their contests
    Then that contest says it is not published
    And it shows no join code
    And it does not say that nobody has voted

  Scenario: A contest being prepared still shows the rules it has been given
    Given a signed-in host with a contest still being prepared, scored per couple on two categories
    When they open their contests
    Then that contest shows it is scored per couple
    And it shows it has two categories

  Scenario: A contest whose voting has closed still shows what was sent
    Given a signed-in host with a contest whose voting has closed after two of four people voted
    When they open their contests
    Then that contest shows two of four votes sent

  Scenario: A revealed contest says its results are out
    Given a signed-in host with a revealed contest
    When they open their contests
    Then that contest says its results are public

  Scenario: One host learns nothing about another's contests
    Given a signed-in host with a live contest, alongside a second host with their own live contest that people have voted in
    When the first host opens their contests
    Then only their own contest is listed
    And nothing about the second host's contest, its code or its progress appears

  Scenario: Reading the list is one answer, however many contests there are
    Given a signed-in host with six contests in various states
    When they open their contests
    Then every contest's progress and rules are shown
    And the list is read in one request, not one per contest

  Scenario: The list with all of this on it is still accessible
    Given a signed-in host with a live contest, a contest being prepared, and a revealed contest
    When they open their contests
    Then the screen has no accessibility violations
    And each contest's progress is readable as words, not only as a bar
