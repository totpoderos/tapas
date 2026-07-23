Feature: Directing a contest through the assistant
  A host can tell the assistant, in plain language, what they want to do with
  their contest. The assistant works out which action to take from the tools it
  has, and proposes it — or, when the request is ambiguous, asks the host to
  clarify instead of guessing. The assistant only proposes an action; carrying it
  out, and confirming anything destructive, happens through the tools themselves.

  Scenario: The assistant proposes an action for a clear request
    Given a host assistant with the contest tools available
    When the host asks it to close their contest
    Then the assistant proposes closing that contest

  Scenario: The assistant asks for clarification when a request is ambiguous
    Given a host assistant with the contest tools available
    When the host asks for something it cannot act on without more detail
    Then the assistant asks the host to clarify instead of proposing an action

  Scenario: The assistant is offered every contest tool to choose from
    Given a host assistant with the contest tools available
    When the host sends any request
    Then the assistant lets the model choose from all of the contest tools
