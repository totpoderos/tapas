Feature: Managing a contest draft
  Before a contest goes live a host builds it up as a draft: naming it,
  choosing the rules, and listing participants. A draft can be edited or
  discarded, every change is recorded, and a host only ever sees their own
  drafts. A draft that is missing what it needs cannot be saved.

  Scenario: A host saves a new draft
    Given a host
    When the host saves a draft named "Summer Tapas 2026" scored per person with couples barred
    Then the draft is stored
    And the draft appears among the host's drafts
    And the audit log records that the draft was saved by that host

  Scenario: A host edits a draft
    Given a host with a saved draft named "Summer Tapas 2026"
    When the host renames the draft to "Summer Tapas Final"
    Then the stored draft is named "Summer Tapas Final"
    And the audit log records the change with the previous and the new name

  Scenario: A host discards a draft
    Given a host with a saved draft named "Summer Tapas 2026"
    When the host discards the draft
    Then the draft no longer appears among the host's drafts
    And the audit log records that the draft was discarded

  Scenario: A draft without a name cannot be saved
    Given a host
    When the host tries to save a draft with no name
    Then saving is rejected because a name is required

  Scenario: A host only sees their own drafts
    Given a host with a saved draft named "Summer Tapas 2026"
    And another host with a saved draft named "Winter Tapas"
    When the host lists their drafts
    Then only "Summer Tapas 2026" appears
