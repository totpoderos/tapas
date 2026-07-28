Feature: A host deletes a contest
  Nothing a host makes can be taken back today. A contest created by mistake, a
  duplicate, a rehearsal before the real party — all of it stays, and so does
  every participant's name, dish and vote. A host can now delete a contest they
  own, at any point in its life, and deleting really deletes: the contest goes,
  and so does everything held about it. What is left behind is a single record
  that the deletion happened — who did it, when, and that they confirmed it —
  carrying none of what was erased. Because there is no undo, deleting is always
  confirmed, and once anyone has taken part the host must reproduce the
  contest's name before it will go.

  Scenario: A host deletes a contest that has not started
    Given a host with a contest they are still preparing
    When they delete it
    Then it is gone from their contests
    And asking for it again finds nothing

  Scenario: A host deletes a contest that is running
    Given a running contest with places claimed, dishes entered and votes cast
    When its host deletes it, reproducing its name
    Then the contest is gone
    And every dish, score and vote cast in it is gone too

  Scenario: A host deletes a contest whose results are out
    Given a contest that has been fully voted, closed, and revealed
    When its host deletes it, reproducing its name
    Then the contest is gone
    And its results can no longer be read

  Scenario: The join code is released
    Given a running contest that a host has deleted
    When someone tries to join with the code it was using
    Then they are told there is no such contest

  Scenario: A host cannot delete another host's contest
    Given a contest belonging to another host
    When a host tries to delete it
    Then it is refused as not allowed
    And that contest is untouched

  Scenario: Deleting requires being signed in
    Given a contest
    When it is deleted with nobody signed in
    Then it is refused as not signed in

  Scenario: Deleting the same contest twice
    Given a contest its host has already deleted
    When they delete it again
    Then they are told there is no such contest

  Scenario: The recorded history is erased with the contest
    Given a contest that was prepared, published and closed
    When its host deletes it, reproducing its name
    Then none of that recorded history remains

  Scenario: The deletion itself is recorded
    Given a host with a contest they are still preparing
    When they delete it
    Then a single entry records that this host deleted this contest, and that they confirmed it

  Scenario: The record left behind carries no personal detail
    Given a running contest with named participants and dishes entered
    When its host deletes it, reproducing its name
    Then the entry left behind names none of them

  Scenario: A deleted contest's history cannot be read back
    Given a contest its host has already deleted
    When they ask to read its history
    Then they are told there is no such contest

  Scenario: Deleting a contest people are taking part in demands its name
    Given a running contest with places claimed
    When its host tries to delete it without reproducing its name
    Then it is refused
    And the contest is untouched

  Scenario: The wrong name does not delete
    Given a running contest with places claimed
    When its host tries to delete it giving the wrong name
    Then it is refused
    And the contest is untouched

  Scenario: A participant cannot act on a deleted contest
    Given a running contest that a participant was voting in
    When its host deletes it and the participant tries to send their vote
    Then it is refused
    And no vote is recorded

  Scenario: A participant is told the contest is gone rather than that it never existed
    Given a running contest that a participant was voting in
    When its host deletes it and the participant looks for the results
    Then they are told the contest is gone
