Feature: Reading the participant app in English or Spanish

  A cook arrives at a venue, opens the link on their own phone, and should be
  able to read it in their language. Every screen of the participant app can be
  read in English or Spanish, chosen from a language selector present on every
  screen but the revealed results — which carry no header at all, and are read
  in the language chosen before them. On a first visit the app follows the
  browser's preferred language,
  falling back to English; once chosen, the choice is remembered across
  navigation and reloads. The document's language attribute is kept in step so
  assistive technology pronounces the page correctly.

  What people typed — contest names, their own names, the dishes they cooked —
  is theirs, and is never translated.

  Scenario: A first visit follows a supported browser language
    Given a cook whose phone is set to Spanish
    When they open the join screen for the first time
    Then the screen is shown in Spanish
    And the document language is "es"

  Scenario: An unsupported browser language falls back to English
    Given a cook whose phone is set to a language the app does not offer
    When they open the join screen
    Then the screen is shown in English

  Scenario: Choosing a language switches the whole screen at once
    Given a cook reading the join screen in English
    When they choose "Español" from the language selector
    Then the whole screen is shown in Spanish
    And no reload was needed

  Scenario: The choice is remembered while they play
    Given a cook who has chosen Spanish
    When they take their place and move on to their dish
    Then that screen is shown in Spanish too
    And it is still Spanish after they reload

  Scenario: What people wrote is left in their own words
    Given a contest whose dishes were entered in Spanish
    When a cook reads the dish list with the app in English
    Then the dish names appear exactly as they were written

  Scenario: The language selector is usable by everyone
    Given a cook on the join screen
    Then the language selector has a visible label
    And the screen has no accessibility violations
