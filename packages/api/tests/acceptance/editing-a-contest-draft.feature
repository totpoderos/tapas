Feature: Editing a contest draft's rules
  While a contest is still a draft, a host can change any of its rules — not just
  its name: how dishes are attributed, the anti-bias pairings, how it is scored,
  who is taking part (adding or removing participants), which participants are a
  couple, and which participants may not score each other. A draft need not be
  complete or valid to be saved this way; only its name is still required, and
  the full rules are checked later, when the host tries to publish. Every change
  is recorded, and a host can only ever edit their own draft.

  Scenario: A host changes how dishes are attributed
    Given a host preparing a draft named "Tapas Night" scored per person
    When the host revises the draft to be scored per couple
    Then the draft is scored per couple

  Scenario: A host changes the anti-bias pairing
    Given a host preparing a draft named "Tapas Night" with couples barred from scoring each other
    When the host revises the draft so that no one is barred from scoring on account of pairings
    Then no one is barred from scoring on account of pairings

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

  Scenario: A host pairs participants as couples in their draft
    Given a host preparing a draft named "Tapas Night" with Ana, Bob, Carmen and Dan taking part
    When the host revises the draft so that Ana and Bob are a couple, and Carmen and Dan are a couple
    Then Ana and Bob are recorded as a couple
    And Carmen and Dan are recorded as a couple

  Scenario: A host bars one participant from scoring another
    Given a host preparing a draft named "Tapas Night" with Ana and Bob taking part
    When the host revises the draft so that Ana may not score Bob
    Then Ana is recorded as not scoring Bob

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
