Feature: Managing a draft's participants by name
  While a contest is still a draft, a host can add and remove the people taking
  part, naming the contest the way they say it rather than by an internal id.
  Adding and removing only ever change the host's own draft, and are matched to a
  single draft by name — when a name is shared by more than one, the host is
  offered the choice. Once a contest is published its participants are settled, so
  this is for drafts only.

  Scenario: A host adds a participant to their draft by name
    Given a host preparing a draft named "Tapas Night" with Ana and Bob taking part
    When the host adds "Carmen" to "Tapas Night"
    Then Ana, Bob and Carmen are taking part in the draft
    And the audit log records the change

  Scenario: A host removes a participant from their draft by name
    Given a host preparing a draft named "Tapas Night" with Ana, Bob and Carmen taking part
    When the host removes "Carmen" from "Tapas Night"
    Then only Ana and Bob are taking part in the draft

  Scenario: Removing a participant also clears their pairings
    Given a host preparing a draft named "Tapas Night" where Ana and Bob are a couple
    When the host removes "Bob" from "Tapas Night"
    Then only Ana is taking part in the draft
    And Ana is no longer paired with anyone

  Scenario: When two drafts share a name, the host is offered the choice
    Given a host preparing two drafts both named "Tapas Night"
    When the host adds "Carmen" to "Tapas Night"
    Then the host is offered both drafts to choose from
    And neither draft is changed

  Scenario: A host cannot manage the participants of a published contest by name
    Given a host with a published contest named "Balcony Cook-off"
    When the host adds "Carmen" to "Balcony Cook-off"
    Then no draft is found to change

  Scenario: A host cannot manage another host's draft participants
    Given a host, and a second host preparing a draft named "Their Draft"
    When the first host adds "Carmen" to the other host's draft "Their Draft"
    Then no draft is found to change

  Scenario: Managing participants requires being signed in
    When adding a participant is attempted with no one signed in
    Then the request is refused as not authorized
