Feature: Publishing a contest
  Publishing turns a host's draft into a live contest: its scoring rules are
  worked out and fixed, a join code is issued so participants can enter, and the
  draft is retired. Only the owning host may publish, and a draft that is
  incomplete or whose rules would leave someone unable to score cannot be
  published.

  Scenario: A host publishes a complete draft
    Given a host with a complete draft named "Summer Tapas 2026" for 4 people in 2 couples, scored per person with couples barred
    When the host publishes the draft
    Then the draft becomes a live contest named "Summer Tapas 2026"
    And a join code is issued for the contest
    And the draft no longer appears among the host's drafts
    And the audit log records that the contest was published

  Scenario: A draft whose participants were given by name alone can be published
    Given a host with a draft whose participants were listed by name only
    Then each participant can be told apart from the others
    When the host publishes that draft
    Then the contest goes live

  Scenario: An incomplete draft cannot be published
    Given a host with a draft named "Half-baked" that has no scoring rules yet
    When the host tries to publish the draft
    Then publishing is rejected because the draft is incomplete
    And no contest is created

  Scenario: A draft that leaves a judge unable to score cannot be published
    Given a host with a draft for a single couple, scored per person with couples barred
    When the host tries to publish the draft
    Then publishing is rejected because a judge could score nothing
    And no contest is created

  Scenario: A host cannot publish another host's draft
    Given a host with a complete draft named "Summer Tapas 2026" for 4 people in 2 couples, scored per person with couples barred
    And another host
    When the other host tries to publish the draft
    Then publishing is rejected because the draft is not theirs

  Scenario: Each published contest gets its own join code
    Given a host with two complete drafts
    When the host publishes both drafts
    Then the two contests have different join codes
