Feature: Editing a contest draft's rules
  While a contest is still a draft, a host can change any of its rules — not just
  its name: its format, how it is scored, who is taking part (adding or removing
  participants), and who is paired with whom. The format is the whole of what a
  contest says about who cooks and who may not score whom, so there is no second
  rule to set beside it and no pairs to bar by hand. A draft need not be
  complete or valid to be saved this way; only its name is still required, and
  the full rules are checked later, when the host tries to publish. Every change
  is recorded, and a host can only ever edit their own draft.

  Scenario: A host changes the contest's format
    Given a host preparing a draft named "Tapas Night" where everyone is on their own
    When the host revises the draft so that couples cook together
    Then the draft is one where couples cook together

  Scenario: A host changes the format back to one where nobody is kept apart
    Given a host preparing a draft named "Tapas Night" where everyone is on their own with partners kept apart
    When the host revises the draft so that everyone is on their own
    Then the draft is one where everyone is on their own

  Scenario: A format the contest cannot have is refused
    Given a host preparing a draft named "Tapas Night" where everyone is on their own
    When the host tries to revise the draft to a format that is not one of the three
    Then the revision is rejected because the format is not one the contest can have
    And the draft is still one where everyone is on their own

  Scenario: A host changes their draft's scoring and participants
    Given a host preparing a draft named "Tapas Night"
    When the host revises the draft to be scored on "Presentation" and "Taste", with Ana, Bob and Carmen taking part
    Then the draft is scored on "Presentation" and "Taste"
    And Ana, Bob and Carmen are taking part
    And the audit log records the change to the draft

  Scenario: A host removes a participant
    Given a host preparing a draft named "Tapas Night" with Ana, Bob and Carmen taking part
    When the host revises the draft to remove Carmen
    Then only Ana and Bob are taking part

  Scenario: A host pairs participants in their draft
    Given a host preparing a draft named "Tapas Night" with Ana, Bob, Carmen and Dan taking part
    When the host revises the draft so that Ana and Bob are partners, and Carmen and Dan are partners
    Then Ana and Bob are recorded as partners
    And Carmen and Dan are recorded as partners

  Scenario: An edited draft still requires a name
    Given a host preparing a draft named "Tapas Night"
    When the host tries to revise the draft to have no name
    Then the revision is rejected because a name is required

  Scenario: A host cannot edit another host's draft
    Given a host, and a second host preparing a draft named "Their Draft"
    When the first host tries to revise the other host's draft
    Then the revision is refused and the other host's draft is unchanged

  Scenario: Editing a draft requires being signed in
    When editing a draft is attempted with no one signed in
    Then the request is refused as not authorized
