Feature: Managing a draft's participants through a connected assistant
  A host can ask their assistant to add or remove someone from a contest they are
  still preparing — "add Carmen to Tapas Night" — naming the contest rather than
  quoting an id. The assistant acts strictly as that host: it changes only the
  host's own drafts, and only while the token is valid. Adding is carried out
  straight away; removing someone is a destructive change, so the assistant does
  not do it until the host confirms.

  Scenario: The assistant adds a participant to a draft by name
    Given a host with a personal access token and a draft named "Tapas Night" with Ana and Bob taking part
    When the assistant is asked to add "Carmen" to "Tapas Night" with the host's token
    Then Ana, Bob and Carmen are taking part in the draft

  Scenario: Removing a participant is not carried out until the host confirms
    Given a host with a personal access token and a draft named "Tapas Night" with Ana and Bob taking part
    When the assistant is asked to remove "Bob" from "Tapas Night" without a confirmation
    Then the assistant asks the host to confirm first
    And Bob is still taking part in the draft

  Scenario: The assistant removes a participant once the host confirms
    Given a host with a personal access token and a draft named "Tapas Night" with Ana and Bob taking part
    When the assistant is asked to remove "Bob" from "Tapas Night" with a valid confirmation
    Then only Ana is taking part in the draft

  Scenario: Without a valid token the assistant cannot add a participant
    When the assistant is asked to add a participant without a valid personal access token
    Then the request is refused as not authorized
