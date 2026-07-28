## ADDED Requirements

### Requirement: Every screen can be read in English or Spanish
Both frontends SHALL present all of their own interface text — labels, buttons, headings, helper and validation messages — in either English or Spanish. Text that originates outside the interface (contest and participant names, the assistant's replies, audit-log entries) is data, not interface text, and SHALL be left as it is.

#### Scenario: A screen reads in the chosen language
- **WHEN** a visitor reads a screen with Spanish chosen
- **THEN** every piece of that screen's interface text is shown in Spanish

#### Scenario: Data is not translated
- **WHEN** a visitor reads, in Spanish, a screen that shows a contest named "Tapas Night"
- **THEN** the contest's name is still shown as "Tapas Night"

### Requirement: A language selector is present on every screen
Each frontend SHALL offer, on every screen, a single labelled control for choosing the interface language. Choosing a language SHALL switch the whole screen at once, with no reload.

#### Scenario: Choosing a language switches the screen
- **WHEN** a visitor reading a screen in English chooses Spanish from the language selector
- **THEN** the whole screen is shown in Spanish without reloading

#### Scenario: The selector is accessible
- **WHEN** a visitor reaches the language selector
- **THEN** it is a labelled control operable by keyboard, announced to assistive technology, with no accessibility violations

### Requirement: A first visit follows the browser, then the visitor's choice is remembered
On a visitor's first visit, the interface language SHALL follow the browser's preferred language when that language is offered, and SHALL fall back to English otherwise. Once a visitor chooses a language, that choice SHALL be remembered and SHALL take precedence over the browser on later visits, surviving navigation between screens and reloads.

#### Scenario: A first visit follows a supported browser language
- **WHEN** a visitor whose browser prefers Spanish opens the app for the first time
- **THEN** the app is shown in Spanish

#### Scenario: An unsupported browser language falls back to English
- **WHEN** a visitor whose browser prefers a language the app does not offer opens the app
- **THEN** the app is shown in English

#### Scenario: A chosen language is remembered across navigation and reload
- **WHEN** a visitor chooses Spanish, then moves to another screen and reloads
- **THEN** the app is still shown in Spanish

### Requirement: The document language attribute reflects the current language
Whenever the interface language is set or changed, the document's language attribute (`<html lang>`) SHALL be updated to the matching language tag, so assistive technology pronounces the page correctly.

#### Scenario: The document language follows the interface language
- **WHEN** a visitor switches the interface to Spanish
- **THEN** the document's language attribute becomes "es"

### Requirement: Adding a language does not change the screens
The set of offered languages SHALL be defined in one place, and each language's text SHALL live in its own translation resources. Adding a further language SHALL require only adding its resources and registering it in that one place — no screen or component is changed.

#### Scenario: A new language is added by its resources alone
- **WHEN** a new language's translation resources are added and the language is registered in the single list of offered languages
- **THEN** it becomes available in the selector on every screen with no change to any screen or component
