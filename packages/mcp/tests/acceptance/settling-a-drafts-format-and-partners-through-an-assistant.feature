Feature: Settling a draft's format and partners through a connected assistant
  A host says what kind of contest they are running and who is paired with whom,
  and the assistant settles it on the draft they name. The format is the whole of
  what a contest says about who cooks and who may not score whom; a partnership
  is the only way two people are kept apart.

  A partnership is between two people, so it is always set on both of them at
  once. Setting one side alone would leave the draft holding a partnership only
  one of them knows about — a state publishing rejects, with a reason the host
  cannot connect to anything they asked for.

  People are named the way a host says them, so a name resolves the way a contest
  name does: one person is acted on, several are offered to choose from, and none
  is said plainly. This is for drafts only.

  Scenario: The assistant says what kind of contest a draft is
    Given a host with a personal access token and a draft named "Tapas Night" where everyone is on their own
    When the assistant is asked to make "Tapas Night" a contest where couples cook together
    Then "Tapas Night" is a contest where couples cook together

  Scenario: The assistant pairs two people
    Given a host with a personal access token and a draft named "Tapas Night" with Ana, Bob, Carmen and Dan taking part
    When the assistant is asked to pair Ana with Bob in "Tapas Night"
    Then Ana and Bob are partners in "Tapas Night"

  # The half a host does not say out loud. Pairing Ana with Carmen when Ana was
  # already with Bob must leave Bob unpartnered, not still pointing at Ana.
  Scenario: Pairing someone who already had a partner frees the one they leave
    Given a host with a personal access token and a draft named "Tapas Night" where Ana and Bob are partners, with Carmen and Dan also taking part
    When the assistant is asked to pair Ana with Carmen in "Tapas Night"
    Then Ana and Carmen are partners in "Tapas Night"
    And Bob has no partner in "Tapas Night"
    And Dan has no partner in "Tapas Night"

  Scenario: The assistant leaves someone without a partner
    Given a host with a personal access token and a draft named "Tapas Night" where Ana and Bob are partners
    When the assistant is asked to leave Ana without a partner in "Tapas Night"
    Then Ana has no partner in "Tapas Night"
    And Bob has no partner in "Tapas Night"

  Scenario: Pairing somebody who is not taking part changes nothing
    Given a host with a personal access token and a draft named "Tapas Night" with Ana and Bob taking part
    When the assistant is asked to pair Ana with "Zoe" in "Tapas Night"
    Then the request is refused because nobody by that name is taking part
    And Ana has no partner in "Tapas Night"

  # A display name is an address here, exactly as a contest name is one. Two
  # people called "Ana" make it useless as an address, so the host is asked
  # rather than one of them being picked.
  Scenario: A name two people share is put back to the host
    Given a host with a personal access token and a draft named "Tapas Night" with two people called "Ana", and Bob taking part
    When the assistant is asked to pair "Ana" with Bob in "Tapas Night"
    Then the request is refused because more than one person has that name
    And nobody in "Tapas Night" has a partner

  Scenario: Pairing somebody with themselves is refused
    Given a host with a personal access token and a draft named "Tapas Night" with Ana and Bob taking part
    When the assistant is asked to pair Ana with Ana in "Tapas Night"
    Then the request is refused because a person cannot be their own partner
    And Ana has no partner in "Tapas Night"

  Scenario: Changing the format leaves the people and the scoring alone
    Given a host with a personal access token and a draft named "Tapas Night" judged on "Taste", with Ana and Bob taking part
    When the assistant is asked to make "Tapas Night" a contest where couples cook together
    Then "Tapas Night" is still judged on "Taste"
    And Ana and Bob are still taking part in "Tapas Night"

  # The same line Slice C settled for the score range: what is wrong with this
  # shows only against the whole contest, which is what publishing checks. The
  # form stores it too, and refusing here would be a validator the form does not
  # share.
  Scenario: A format the people cannot yet satisfy is kept until publishing refuses it
    Given a host with a personal access token and a draft named "Tapas Night" with Ana and Bob taking part, nobody paired
    When the assistant is asked to make "Tapas Night" a contest where couples cook together
    Then "Tapas Night" is a contest where couples cook together
    And publishing "Tapas Night" is refused because somebody has no partner

  Scenario: A published contest's format cannot be changed
    Given a host with a personal access token and a published contest named "Tapas Night"
    When the assistant is asked to make "Tapas Night" a contest where couples cook together
    Then no draft is found
