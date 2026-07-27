Feature: Getting a contest's details by name
  A host wants to see what is inside one of their contests — who is taking part
  and how it is scored — by naming it, the way they would say it out loud. This
  works whether the contest is still a draft being prepared or already published,
  and searches only the host's own contests. When a name is unambiguous the
  details come back; when two contests share a name, the host is offered the
  choice; a name that matches nothing finds nothing.

  Scenario: A host reads the details of their draft by name
    Given a host preparing a draft named "Tapas Night" with Ana and Bob taking part and a "Taste" category
    When the host asks for the details of "Tapas Night"
    Then the details name Ana and Bob as taking part
    And the details name "Taste" as a scoring category

  Scenario: A host reads the details of their live contest by name
    Given a host with a live contest named "Balcony Cook-off" with Ana and Bob taking part
    When the host asks for the details of "Balcony Cook-off"
    Then the details name Ana and Bob as taking part

  Scenario: Reading details by name ignores capitalisation
    Given a host preparing a draft named "Tapas Night" with Ana and Bob taking part and a "Taste" category
    When the host asks for the details of "tapas night"
    Then the details name Ana and Bob as taking part

  Scenario: When two contests share a name, the host is offered the choice
    Given a host with two contests both named "Tapas Night"
    When the host asks for the details of "Tapas Night"
    Then the host is offered both contests to choose from

  Scenario: Asking for details of a name that matches nothing finds nothing
    Given a host preparing a draft named "Tapas Night" with Ana and Bob taking part and a "Taste" category
    When the host asks for the details of "Paella Sunday"
    Then no contest is found

  Scenario: A host cannot read another host's contest details by name
    Given a host, and a second host with a contest named "Tapas Night"
    When the first host asks for the details of "Tapas Night"
    Then no contest is found

  Scenario: Reading details by name requires being signed in
    When someone not signed in asks for the details of "Tapas Night"
    Then the request is refused as not authorized
