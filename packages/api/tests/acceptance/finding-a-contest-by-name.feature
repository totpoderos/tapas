Feature: Finding a contest by name
  A host thinks of their contests by name, not by an internal identifier. So a
  host can find one of their own contests by its name, the way they would say it
  out loud — capitalisation and nothing else should not get in the way. Matching
  is over the host's own contests only. When a name is unambiguous a single
  contest is found; when two contests happen to share a name, both are offered so
  the host can say which; a name that matches nothing simply finds nothing.

  Scenario: A host finds their contest by its name
    Given a host with a contest named "Tapas Night"
    When the host looks for a contest named "Tapas Night"
    Then the contest named "Tapas Night" is found

  Scenario: Finding a contest by name ignores capitalisation
    Given a host with a contest named "Tapas Night"
    When the host looks for a contest named "tapas night"
    Then the contest named "Tapas Night" is found

  Scenario: When two contests share a name, both are offered
    Given a host with two contests both named "Tapas Night"
    When the host looks for a contest named "Tapas Night"
    Then both contests named "Tapas Night" are offered

  Scenario: A name that matches nothing finds nothing
    Given a host with a contest named "Tapas Night"
    When the host looks for a contest named "Paella Sunday"
    Then no contest is found

  Scenario: A host cannot find another host's contest by name
    Given a host, and a second host with a contest named "Tapas Night"
    When the first host looks for a contest named "Tapas Night"
    Then no contest is found

  Scenario: Finding a contest by name requires being signed in
    When someone not signed in looks for a contest named "Tapas Night"
    Then the request is refused as not authorized
