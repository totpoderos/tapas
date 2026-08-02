Feature: Addressing a contest by its name through a connected assistant
  A host talks about their contests the way they say them — "close Tapas Night" —
  and never has to know or quote an internal id. Every action the assistant can
  take names the contest it acts on, and every one of them resolves that name the
  same way: one contest bearing it is acted on, several means the host is asked
  which they meant and nothing changes meanwhile, and none means nothing changes
  and the answer says so. Only the host's own contests are ever searched, so
  another host's contest cannot be reached by naming it — it simply is not there.

  Scenario: An action names the contest it acts on
    Given a host with a personal access token and a running contest named "Tapas Night"
    When the assistant is asked to close "Tapas Night" with the host's token, confirming
    Then the contest named "Tapas Night" is closed

  Scenario: A read names the contest it reads
    Given a host with a personal access token and a running contest named "Tapas Night"
    When the assistant is asked to read "Tapas Night" with the host's token
    Then the contest named "Tapas Night" is returned

  Scenario: A name several contests share changes nothing and offers the choice
    Given a host with a personal access token and two running contests both named "Tapas Night"
    When the assistant is asked to close "Tapas Night" with the host's token, confirming
    Then both contests are offered to choose from
    And neither contest is closed

  Scenario: A name no contest has changes nothing
    Given a host with a personal access token and a running contest named "Tapas Night"
    When the assistant is asked to close "Sunday Roast" with the host's token, confirming
    Then no contest is found
    And the contest named "Tapas Night" is still running

  Scenario: A name matches without regard to case
    Given a host with a personal access token and a running contest named "Tapas Night"
    When the assistant is asked to close "tapas night" with the host's token, confirming
    Then the contest named "Tapas Night" is closed

  Scenario: Another host's contest is never reached by name
    Given a host with a personal access token, and a running contest named "Tapas Night" owned by a different host
    When the assistant is asked to close "Tapas Night" with the host's token, confirming
    Then no contest is found
    And the other host's contest is still running

  # A shared name changes nothing at either step: not on the first, unconfirmed
  # request, and not on the confirmed one either (above). Worth pinning both,
  # because a destructive action is asked about before it is resolved — the host
  # can be asked to confirm closing a name two contests share, and only then be
  # told which they must choose. Nothing acts on the wrong contest, but the
  # question is put before the ambiguity is known.
  Scenario: An unconfirmed request on a shared name changes nothing
    Given a host with a personal access token and two running contests both named "Tapas Night"
    When the assistant is asked to close "Tapas Night" with the host's token, without confirming
    Then neither contest is closed
