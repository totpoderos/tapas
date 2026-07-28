Feature: Getting a contest's details through a connected assistant
  A host asks their assistant about a contest by name — "who's in Tapas Night?" —
  and the assistant reads its details: who is taking part and how it is scored.
  The assistant acts strictly as that host: it reads only the host's own
  contests, and only while the token is valid. When a name is unambiguous the
  details come back; when two contests share a name, the assistant is given both
  so it can ask the host which one.

  Scenario: The assistant reads a contest's details by name
    Given a host with a personal access token and a contest named "Tapas Night" with Ana and Bob taking part
    When the assistant is asked for the details of "Tapas Night" with the host's token
    Then the details name Ana and Bob as taking part

  Scenario: The assistant is offered the choice when several share a name
    Given a host with a personal access token and two contests both named "Tapas Night"
    When the assistant is asked for the details of "Tapas Night" with the host's token
    Then both contests are offered to choose from

  Scenario: The assistant reads only the host's own contest details
    Given a host with a personal access token, and a contest named "Tapas Night" owned by a different host
    When the assistant is asked for the details of "Tapas Night" with the host's token
    Then no contest is found

  Scenario: Without a valid token the assistant cannot read contest details
    When the assistant is asked for a contest's details without a valid personal access token
    Then the request is refused as not authorized
