## ADDED Requirements

### Requirement: Every way through the panel is present on every screen
The panel SHALL carry its navigation on every screen a signed-in person can reach, so that no surface is a dead end and no journey has to pass back through the contest list. From anywhere in the panel a host SHALL be able to reach their contests, the assistant, and the activity of their contests, and SHALL be able to start a new contest and sign out.

#### Scenario: A host reaches another surface without going home first
- **WHEN** a signed-in host is reading one of their contests and wants the assistant
- **THEN** the way to the assistant is present on that screen
- **AND** taking it leads to the assistant

#### Scenario: The navigation is present on every host screen
- **WHEN** a signed-in host visits their contests, the assistant, an activity log, a contest, a draft, and the results of a revealed contest
- **THEN** the panel's navigation is present on each of them

#### Scenario: The screens a signed-in host cannot reach carry no navigation
- **WHEN** nobody is signed in and the sign-in screen is shown
- **THEN** the panel's navigation is not present

### Requirement: The navigation scopes itself to the contest a host is in
When a host is working inside one contest, the panel's navigation SHALL be about that contest — naming it, saying what state it is in, offering the ways into it (its control room, its rules, its participants, its activity log, and its results), and offering a way back out to all of their contests. Outside a contest the navigation SHALL be about the deployment instead.

#### Scenario: Inside a contest the navigation is about that contest
- **WHEN** a signed-in host opens one of their live contests
- **THEN** the navigation names that contest and says it is live
- **AND** it offers the ways into that contest, and a way back to all of their contests

#### Scenario: Outside a contest the navigation is about the deployment
- **WHEN** a signed-in host is reading their list of contests
- **THEN** the navigation offers their contests, the assistant, and activity, and names no single contest

#### Scenario: A way in that is not available yet is not offered as if it were
- **WHEN** a signed-in host is inside a contest whose results have not been revealed
- **THEN** the way to its results is shown as not available yet
- **AND** it cannot be taken

### Requirement: The navigation counts the host's contests by state
Alongside the way to all of their contests, the panel SHALL say how many contests the host has in total and how many are in each state — live, being prepared, and finished (closed or revealed) — so a host can see what needs attention before opening anything.

#### Scenario: The counts describe the host's own contests
- **WHEN** a signed-in host with two live contests, four being prepared, and six finished reads any screen of the panel
- **THEN** the navigation says twelve contests in total, two live, four being prepared, and six finished

#### Scenario: A host with no contests is counted as none
- **WHEN** a signed-in host who has no contests reads the panel
- **THEN** the navigation says none, rather than nothing at all

### Requirement: The panel is a host's workspace or an administrator's, never both
The two kinds of work do not mix in the panel. Which navigation is drawn SHALL follow what the API reports the signed-in account to be, and the other kind's ways in SHALL be absent entirely rather than shown and refused:

- an **administrator's** navigation SHALL offer administrative work only — the people of the deployment — and SHALL offer no contests, no assistant, and no activity;
- a **host's** navigation SHALL offer host work only, and SHALL carry no administrative group.

An administrator SHALL arrive at the people when they sign in, and SHALL be taken there if they ask for a host surface by its address. A host asking for the people by its address SHALL be told plainly that it is not for them, and left there.

What the panel draws SHALL authorize nothing. The API decides on every request regardless, and an administrator retains a host's powers there — this requirement is about where the work is done in the panel, not about what an account may do.

#### Scenario: An administrator is offered administrative work only
- **WHEN** a signed-in administrator reads any screen of the panel
- **THEN** the navigation offers the way to the people
- **AND** it offers no contests, no assistant, and no activity

#### Scenario: A host is offered host work only
- **WHEN** a signed-in ordinary host reads any screen of the panel
- **THEN** the navigation carries no administrative group
- **AND** no way to the people is offered anywhere

#### Scenario: An administrator lands on the people
- **WHEN** an administrator signs in
- **THEN** they arrive at the people

#### Scenario: An administrator asking for a host surface is taken to the people
- **WHEN** a signed-in administrator asks for the contest list by its address
- **THEN** they arrive at the people instead

#### Scenario: Hiding the ways in is not the protection
- **WHEN** an ordinary host reaches the people screen anyway, by its address
- **THEN** the API refuses it and the host is told plainly, as it would be with no navigation at all

#### Scenario: What the panel hides is still allowed to the API
- **WHEN** an administrator acting through a personal access token creates a draft
- **THEN** it is created for them, exactly as before — the panel drawing them no contests changes nothing about what the API permits

### Requirement: The panel always says where the host is
The panel SHALL state, on every screen, which surface the host is on: the way in that leads there SHALL be marked as the current one, and the screen SHALL be named in the panel's header, under the contest it belongs to when it belongs to one.

#### Scenario: The current surface is marked in the navigation
- **WHEN** a signed-in host is reading the activity log of one of their contests
- **THEN** the way to the activity log is marked as the current one
- **AND** the other ways in are not

#### Scenario: The header names the surface under its contest
- **WHEN** a signed-in host is reading the activity log of a contest
- **THEN** the panel's header names the contest and then the activity log

### Requirement: The panel says what is happening while it waits, finds nothing, or fails
Every surface of the panel SHALL tell the host what is happening rather than showing an empty frame: that it is still loading, that there is nothing there yet together with the way to make something, or that it could not be loaded together with a way to try again. Each SHALL be announced to assistive technology.

#### Scenario: Loading is stated
- **WHEN** a signed-in host opens their contests and the answer has not arrived
- **THEN** the panel says it is loading them, and says so to assistive technology

#### Scenario: Having none invites the first one
- **WHEN** a signed-in host who has no contests opens their contests
- **THEN** the panel says they have none yet
- **AND** offers to create their first

#### Scenario: A failure can be retried
- **WHEN** a signed-in host opens their contests and the request fails
- **THEN** the panel says they could not be loaded, as an alert
- **AND** offers a way to try again

### Requirement: The navigation is operable by keyboard and by screen reader
The panel's navigation SHALL be a navigation landmark with an accessible name, its ways in SHALL be links or buttons operable by keyboard with a visible focus indicator, the current one SHALL be marked in a way assistive technology conveys, and every target SHALL be at least 44 by 44 pixels. Skipping to the surface SHALL remain possible from the first tab stop of every screen, and SHALL land on the surface rather than inside the navigation. A contest's state SHALL be conveyed by its wording and its shape, never by colour alone.

#### Scenario: The navigation is a named landmark
- **WHEN** a signed-in host reads any screen of the panel with assistive technology
- **THEN** the navigation is reported as a navigation landmark with a name

#### Scenario: Skipping goes past the navigation to the surface
- **WHEN** a signed-in host presses tab once on any screen of the panel and takes the first thing offered
- **THEN** focus moves to the surface, past the navigation

#### Scenario: The whole panel is reachable by keyboard
- **WHEN** a signed-in host moves through a screen of the panel using only the keyboard
- **THEN** every way in and every action can be reached and taken, each showing where focus is

#### Scenario: State does not rely on colour
- **WHEN** a contest's state is shown anywhere in the panel
- **THEN** it is named in words and carries a distinct shape, as well as its colour

### Requirement: The panel reads in either language and in either theme
Everything the shell itself says SHALL be translated into English and Spanish, and SHALL be legible in both the light and the dark theme, at up to 200% zoom, without any text or action being cut off or overlapping.

#### Scenario: The navigation follows the chosen language
- **WHEN** a signed-in host switches the language to Spanish
- **THEN** everything the navigation and the header say is in Spanish
- **AND** the names of their contests are unchanged

#### Scenario: The panel holds together in the dark theme at 200%
- **WHEN** a signed-in host reads the panel in the dark theme at 200% zoom
- **THEN** every way in and every action remains legible and reachable
