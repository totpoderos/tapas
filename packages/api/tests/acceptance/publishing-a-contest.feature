Feature: Publishing a contest
  Publishing turns a host's draft into a live contest: its scoring rules are
  worked out and fixed, a join code is issued so participants can enter, and the
  draft is retired. Only the owning host may publish, and a draft that is
  incomplete or whose rules would leave someone unable to score cannot be
  published.

  Scenario: A host publishes a complete draft
    Given a host with a complete draft named "Summer Tapas 2026" for 4 people in 2 couples, where everyone is on their own with partners kept apart
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

  # A draft is not publishable until it says three things, and a refusal that
  # names the wrong one sends the host to fix what is not broken. This is not
  # hypothetical: a contest prepared entirely by asking the assistant arrives
  # with its people and its scoring settled and no format at all, and was told
  # its scoring rules were missing.
  Scenario: A draft that never said what kind of contest it is says so
    Given a host with a draft that has its people and its scoring but never said what kind of contest it is
    When the host tries to publish the draft
    Then publishing is rejected because the draft does not say what kind of contest it is
    And the refusal does not blame the scoring rules

  Scenario: A draft with nobody taking part says so
    Given a host with a draft that says what kind of contest it is and how it is scored, but has nobody taking part
    When the host tries to publish the draft
    Then publishing is rejected because nobody is taking part

  Scenario: A draft missing more than one thing names them all
    Given a host with a draft that has only a name
    When the host tries to publish the draft
    Then publishing is rejected naming all three of the things it still needs

  # Not a curiosity. A contest judged on nothing gives its participants a ballot
  # with nothing to score, and every dish a total of zero — so the reveal names
  # all of them joint winners of a contest nobody could take part in.
  Scenario: A contest judged on nothing cannot be published
    Given a host with a draft that says what kind of contest it is and who is taking part, but is judged on nothing
    When the host tries to publish the draft
    Then publishing is rejected because the contest is judged on nothing
    And no contest is created

  Scenario: A draft that leaves a judge unable to score cannot be published
    Given a host with a draft for a single couple, where everyone is on their own with partners kept apart
    When the host tries to publish the draft
    Then publishing is rejected because a judge could score nothing
    And no contest is created

  Scenario: A contest for couples cannot be published while somebody has no partner
    Given a host with a draft where couples cook together, for 5 people of whom 4 are 2 couples and 1 has no partner
    When the host tries to publish the draft
    Then publishing is rejected because a participant has no partner
    And no contest is created

  Scenario: A contest for couples publishes once everybody is partnered
    Given a host with a complete draft named "Two by Two" for 6 people in 3 couples, where couples cook together
    When the host publishes the draft
    Then the contest goes live
    And each couple has one dish between them

  Scenario: A host cannot publish another host's draft
    Given a host with a complete draft named "Summer Tapas 2026" for 4 people in 2 couples, where everyone is on their own with partners kept apart
    And another host
    When the other host tries to publish the draft
    Then publishing is rejected because the draft is not theirs

  Scenario: Each published contest gets its own join code
    Given a host with two complete drafts
    When the host publishes both drafts
    Then the two contests have different join codes
