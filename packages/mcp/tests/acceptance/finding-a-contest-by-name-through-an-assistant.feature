Feature: Finding a contest by name through a connected assistant
  A host talks to their assistant about contests by name — "how is Tapas Night
  doing?" — not by an internal identifier. So the assistant can find one of the
  host's contests by name and work with it from there. The assistant acts strictly
  as that host: it finds only contests the host owns, and only while the token is
  valid. When a name is unambiguous a single contest comes back; when two contests
  share a name both are offered so the assistant can ask the host which one.

  Scenario: The assistant finds a contest by name
    Given a host with a personal access token and a contest named "Tapas Night"
    When the assistant is asked to find the contest named "Tapas Night" with the host's token
    Then the contest named "Tapas Night" is found

  Scenario: When several contests share a name, the assistant is given all of them
    Given a host with a personal access token and two contests both named "Tapas Night"
    When the assistant is asked to find the contest named "Tapas Night" with the host's token
    Then both contests named "Tapas Night" are offered

  Scenario: The assistant finds only the host's own contests by name
    Given a host with a personal access token, and a contest named "Tapas Night" owned by a different host
    When the assistant is asked to find the contest named "Tapas Night" with the host's token
    Then no contest is found

  Scenario: Without a valid token the assistant cannot find a contest by name
    When the assistant is asked to find a contest by name without a valid personal access token
    Then the request is refused as not authorized
