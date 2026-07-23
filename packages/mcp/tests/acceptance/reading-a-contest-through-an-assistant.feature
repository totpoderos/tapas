Feature: Reading a contest through a connected assistant
  A host can connect an assistant (or any external client) to their account with
  a personal access token and have it work with their contests on their behalf.
  The assistant acts strictly as that host: it can read only what the host owns,
  and only while the token is valid — it makes no decisions of its own, it just
  carries the host's request through and the host's identity with it. Reading one
  of the host's own contests is the simplest such action, and proves the path.

  Scenario: The assistant reads a contest the host owns
    Given a host with a personal access token and a contest they own
    When the assistant is asked to read that contest with the host's token
    Then the contest is returned

  Scenario: The assistant cannot read a contest the host does not own
    Given a host with a personal access token, and a contest owned by a different host
    When the assistant is asked to read the other host's contest with the first host's token
    Then the request is refused as not allowed

  Scenario: Without a valid token the assistant cannot read a contest
    Given a contest and no valid personal access token
    When the assistant is asked to read the contest without a valid token
    Then the request is refused as not authorized
