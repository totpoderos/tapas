Feature: Chatting with the host assistant
  A signed-in host can direct their contest by chatting with the assistant in
  plain language. The assistant works out what they want and either asks for more
  detail, carries out a reversible action and reports what it did, or — for an
  action that cannot be undone — asks the host to confirm before doing anything.
  A confirmation only authorises the exact action it was given for. Chatting is
  refused when no one is signed in.

  Scenario: The assistant asks for detail when a request is ambiguous
    Given a signed-in host chatting with the assistant
    When they ask for something the assistant cannot act on without more detail
    Then the assistant replies asking them to clarify
    And nothing about their contest changes

  Scenario: The assistant carries out a reversible action and reports it
    Given a signed-in host chatting with the assistant
    When they ask the assistant to start a new draft called "Summer Tapas"
    Then a draft called "Summer Tapas" is saved for them
    And the assistant reports that it did so

  Scenario: The assistant says what it did in plain language
    Given a signed-in host chatting with the assistant
    When the assistant carries out a reversible action but offers no words of its own
    Then the host is still told, in plain language, what was done

  Scenario: The assistant says when an action could not be carried out
    Given a signed-in host chatting with the assistant
    When an action the assistant tries cannot be carried out
    Then the host is told it did not happen
    And the host is told why

  Scenario: A destructive action is not carried out until the host confirms
    Given a signed-in host with a running contest, chatting with the assistant
    When they ask the assistant to close that contest
    Then the contest is not closed
    And the assistant asks the host to confirm closing it

  Scenario: Confirming carries out the destructive action
    Given a host whom the assistant has asked to confirm closing their running contest
    When the host confirms
    Then the contest is closed

  Scenario: A confirmation authorises only the action it was given for
    Given a host who was asked to confirm closing one running contest
    When that confirmation is used to try to close a different contest
    Then the different contest is not closed
    And the host is asked to confirm that action instead

  Scenario: A confirmed action that fails is reported as failed
    Given a signed-in host chatting with the assistant
    When they confirm a destructive action that cannot be carried out
    Then the host is told it did not happen

  Scenario: Chatting with the assistant requires being signed in
    Given no one is signed in
    When a message is sent to the assistant
    Then it is refused as not signed in
