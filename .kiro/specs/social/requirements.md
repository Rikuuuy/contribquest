# Requirements: social

## Introduction

This spec covers the sharing loop: raids (your hero on a friend's graph), challenge links, the copied challenge text, and the 1200×630 PNG share card. The raid fetch itself (both profiles in parallel through the same cache and errors) is in data-import requirement 9; this spec covers the start-screen friend field, the raid wording everywhere a raid is named, the challenge prompt, the copy button, and the card.

Every string and number comes from `prototype/index.html` (`startUser`, the boot code for `?vs=`, `newRun`, `showSummary`, `showEnd`, `refreshContinue`, the `btn-share` and `btn-card` handlers, `makeShareCard`, `TROPHIES`).

PRD IDs covered: FR-SOC-1 to FR-SOC-6. Shared: FR-SOC-1 and FR-SOC-6 fetch behaviour is in data-import; the Graph Raider trophy is in progression requirement 9.

## Glossary

- **You**: the player whose hero is used (`heroSet` in a raid).
- **Friend / map owner**: the user whose graph is the map (`set`).
- **Raid**: a run with `heroSet !== null`.
- **Challenge link**: the URL that sends a friend to the map owner's graph (`?vs=`) or to the demo (`?demo`).

## Requirements

### Requirement 1: Starting a raid

**User story:** As a player, I want to fight my friend's graph with my own hero, so that we can compare.

#### Acceptance criteria

1.1 WHEN the start form is submitted THE SYSTEM SHALL validate the username and the optional friend field with the same rule, show "That is not a valid GitHub username." or "Your friend's username is not a valid GitHub username." without a request, and otherwise call data-import's `loadRun(name, friend)`. [FR-SOC-1, FR-IMP-1]

1.2 WHEN the URL is `/?u=<you>&vs=<friend>` THE SYSTEM SHALL fill both fields and start the same load. [FR-SOC-1, FR-IMP-6]

1.3 WHEN the friend's name equals yours ignoring case THE SYSTEM SHALL run a normal game on your graph. [FR-SOC-1]

1.4 WHEN a raid run starts THE SYSTEM SHALL generate the map, boss, and GitHub statistics from the friend's set and the hero (level, aura, trait, omen) from yours. [FR-SOC-1]

### Requirement 2: Naming both players

**User story:** As a raider, I want every screen to say whose graph I am in, so that the screenshot tells the story.

#### Acceptance criteria

2.1 WHEN a raid loads THE SYSTEM SHALL show "Summoning {you} to raid {friend}'s graph…" (data-import `loadingText`). [FR-SOC-2]

2.2 WHEN a raid starts THE SYSTEM SHALL log "{you} breaks into {friend}'s graph on {fmtDate(start)}. Their Phantom is waiting." in place of the crypt line; the omen line names you. [FR-SOC-2, FR-OMEN-3]

2.3 WHEN the summary of a raid is shown THE SYSTEM SHALL title it "{you} raids the graph of {friend}", label the stats "{you}'s contributions, 91 days", "{friend}'s best day (the boss)", and "{friend}'s year total", and use "its" in the quiet-map line ("…risen from its empty days."). [FR-SOC-2]

2.4 WHEN the results of a raid are shown THE SYSTEM SHALL title them "{friend}'s graph is exorcised." or "{friend}'s graph claimed you.", use "{you} survived 91 haunted days." on a win, head the GitHub card "{FRIEND} ON GITHUB" (upper case), and list both "{you}'s contributions (91 days)" and "{friend}'s contributions (91 days)" before the other GitHub rows. [FR-SOC-2]

2.5 WHEN a raid is saved THE SYSTEM SHALL label the start screen button "Continue {you}'s raid on {friend}". [FR-SOC-2, FR-SAV-1]

### Requirement 3: Challenge links

**User story:** As a player who finished a run, I want to send a friend a link that drops them into the same graph.

#### Acceptance criteria

3.1 WHEN the URL has `vs` and no `u` or `demo` THE SYSTEM SHALL fill the friend field, show "Enter your GitHub username to raid {friend}'s graph with your own hero." in purple on the start screen, and focus the username field. [FR-SOC-3, FR-IMP-6]

3.2 WHEN the challenge link is built THE SYSTEM SHALL take the current page URL and replace its query with `?demo` for a demo map, otherwise `?vs={encodeURIComponent(map owner)}`. [FR-SOC-3]

3.3 WHEN "Copy challenge link" is pressed THE SYSTEM SHALL copy "{link}  {what} as a level {level} {Class} with {dodges} perfect dodges. Raid it with your own graph: can you do better?" (two spaces after the link), where `what` is "I exorcised my GitHub graph" / "My GitHub graph defeated me", or in a raid "I exorcised {friend}'s GitHub graph" / "I died in {friend}'s GitHub graph". [FR-SOC-3]

3.4 WHEN the copy succeeds THE SYSTEM SHALL show "Copied. Send it to a friend and haunt them."; IF the clipboard is unavailable or refuses THEN THE SYSTEM SHALL show the text itself so it can be copied by hand. [FR-SOC-3]

### Requirement 4: Share card

**User story:** As a player, I want an image of my run that I can post, so that people see my graph as a map.

#### Acceptance criteria

4.1 WHEN "Save share card" is pressed THE SYSTEM SHALL draw a 1200×630 canvas with smoothing off, download it as PNG named `contribquest-{map owner}.png`, show the image below the buttons, and show "Share card saved. Post it with your challenge link." [FR-SOC-4]

4.2 WHEN the card is drawn THE SYSTEM SHALL paint the prototype's background: a vertical gradient `#22163a` → `#0b0e14`, 120 stars from `makeRng(5)` in the top 60%, and a moon at (1090, 90) radius 38 with its glow. [FR-SOC-4]

4.3 WHEN the card is drawn THE SYSTEM SHALL write "Contrib" in `#39d353` and "Quest" in `#ff9a3c` at 40 px in "Press Start 2P" at (40, 36) with dark offset shadows, and the 18 px subtitle "{map owner}'s graph: EXORCISED" / "DEFEATED", or in a raid "{you} exorcised {friend}'s graph" / "{you} fell in {friend}'s graph", followed by " · {CLASS}", green on a win and red on a loss, at (40, 100). [FR-SOC-4]

4.4 WHEN the card is drawn THE SYSTEM SHALL draw the full map at tile 38, gap 4, with labels, at (40, 150), with every tile revealed, no fog or lighting, the hero on its tile, and the boss and Gate in their current state. [FR-SOC-4]

4.5 WHEN the card is drawn THE SYSTEM SHALL list, from `x0 = 40 + map width + 40` and `y = 160 + 42i`, the rows Level, Monsters banished, Critical hits, Perfect dodges, Relics (count), Steps, Contributions (91d) (the hero's `total91`), and Streak ("{n} days", the hero set's streak), labels in `#8b98ab` on the left and bold white values right-aligned at x = 1160, in 22 px system sans-serif. [FR-SOC-4]

4.6 WHEN the card is drawn THE SYSTEM SHALL draw each owned relic icon at scale 3 at (x0 + 22 + 46i, 530), and the line "Can you survive this graph? {host}{path}{query}" of the challenge link in `#b48cff` at (40, 590). [FR-SOC-4, FR-REL-4]

### Requirement 5: Client-only sharing

#### Acceptance criteria

5.1 WHEN the card or the challenge text is made THE SYSTEM SHALL build it in the browser from the run state alone and SHALL NOT upload it or send any request. [FR-SOC-5, FR-SAV-2]

5.2 WHEN the card draws the map with every tile revealed THE SYSTEM SHALL not change the run state (the prototype flipped and restored `seen`; the port passes a draw option instead). [FR-SOC-5]

### Requirement 6: Errors

#### Acceptance criteria

6.1 WHEN either profile of a raid or a challenge fails to load THE SYSTEM SHALL show that profile's error on the start screen with the "play the demo" link (presentation requirement 1.4). [FR-SOC-6, FR-IMP-3]

6.2 WHEN a challenge link points at a user that does not exist THE SYSTEM SHALL show the not-found message for that name after you enter your own username. [FR-SOC-6]
