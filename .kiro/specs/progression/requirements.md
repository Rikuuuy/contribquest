# Requirements: progression

## Introduction

This spec covers everything that carries a hero through a run and across runs: starting a run, XP and levels, the Streak Aura, the weekday trait, wisps and chests, races, relics, the daily omen, the end of a run, trophies, save and continue, new run and retry, the privacy rule for network requests, the hero-summary and results facts, and the headless balance simulator with its route rule.

Every rule and number comes from `prototype/index.html` (`xpForLevel`, `levelFor`, `makeTrait`, `makeHero`, `RACES`, `RELICS`, `offerRelic`, `pickRelic`, `newRun`, `enterTile`, `gainXp`, `enterMap`, `win`, `lose`, `TROPHIES`, `awardTrophies`, `renderTrophies`, `refreshStartTrophies`, `save`, `loadSave`, `refreshContinue`, `showSummary`, `showEnd`, the button handlers) and `.kiro/steering/game-rules.md` ("Hero", "Exploration", "Relics", "Daily omen", "Trophies", "Balance simulator").

PRD IDs covered: FR-PRO-1 to FR-PRO-4, FR-SAV-1 to FR-SAV-3, FR-RACE-1, FR-RACE-2, FR-RACE-4, FR-REL-1 to FR-REL-4, FR-OMEN-1 to FR-OMEN-3, FR-TRO-1 to FR-TRO-3, plus PRD Story 4 (streak aura) and the v1.2 weekday trait. Shared: FR-RACE-3 (the race face) is drawn by the presentation spec; the combat-side effects of races, relics, and the curse (FR-RACE-2, FR-REL-2, FR-REL-3, FR-OMEN-2) are applied by combat-timing; raid wording (FR-SOC-2) is added to the functions below by the social spec.

## Glossary

- **Map set**: the `ContributionSet` the map is generated from (`state.set`). In a raid it belongs to the friend.
- **Hero set**: the set the hero is built from: `state.heroSet` in a raid, otherwise the map set.
- **total91**: the sum of counts in the hero set's 91-day window.
- **Today's tile**: the last day of the hero set's window.
- **Run**: one play from `newRun` to `won` or `lost`.
- **Settings**: `{ calm, assist, mute, heroClass, heroRace }` from `cq:v1:settings` (data-import requirement 10).

## Requirements

### Requirement 1: Starting a run

**User story:** As a player, I want the same profile on the same day always to give the same starting hero and map, so that a run is fair and repeatable.

#### Acceptance criteria

1.1 WHEN a run starts THE SYSTEM SHALL treat the hero set as a raid only if it is given and its username differs from the map set's ignoring case; otherwise `heroSet` is `null` and the map set is also the hero set. [FR-SOC-1, FR-PRO-1]

1.2 WHEN a run starts THE SYSTEM SHALL build the hero from the hero set: `xp = round(15 × √total91)`, `level = levelFor(xp)`, `startLevel = level`, `aura = min(floor(streak / 7), 4)`, the weekday trait (requirement 3), `treasure = 0`, `relics = []`, class from `settings.heroClass` (Wanderer if unknown), race from `settings.heroRace` (Human if unknown), stats from combat-timing requirement 3.3, and `hp = maxHp`. [FR-PRO-1, FR-PRO-2, FR-CLS-1, FR-RACE-1, P6]

1.3 WHEN a run starts THE SYSTEM SHALL generate the map from the map set only, start the run RNG at the map seed, place the hero on the start tile, mark it visited, reveal the lantern radius, set every counter in `stats` to 0 and `bossHpLeft` to `null`, set `status` to `exploring`, `bossDown` to false, `shards` to 0, `undying` to false, `relicOffer` to `null`, and copy `calm` and `assist` from settings into the run options. [FR-PRO-1, FR-MAP-3, P18]

1.4 WHEN a run starts THE SYSTEM SHALL log, in order: "You wake in a crypt on {fmtDate(start)}. Somewhere ahead waits the Phantom of your best day."; the omen line (requirement 7.3); and, if `shardsNeeded > 0`, "Its ward is fed by your other big days. Banish {n} elite{s} (Ghouls or Liches) to collect soul shards and break it." with "s" when n > 1. [FR-PRO-1, FR-OMEN-3, FR-MOV-7]

1.5 WHEN map generation fails THE SYSTEM SHALL return the map error instead of a run, so the caller shows it with demo mode. [FR-MAP-4]

### Requirement 2: XP and levels

**User story:** As a player, I want XP from everything I do and a level table I can read, so that progress feels earned.

#### Acceptance criteria

2.1 WHEN the XP needed for level n is read THE SYSTEM SHALL return `25 × n × (n − 1)` (0, 50, 150, 300, 500, 750, 1050, 1400, 1800, 2250), and `levelFor(xp)` SHALL return the highest level up to 10 whose threshold `xp` reaches. [FR-PRO-2]

2.2 WHEN the hero gains XP THE SYSTEM SHALL multiply the amount by 1.1 and round it for a Human, add it to `xp`, and emit an `xp` event with the amount gained. [FR-PRO-1, FR-RACE-2]

2.3 WHEN a gain raises `levelFor(xp)` above the current level THE SYSTEM SHALL set the new level, recompute stats, heal to full, log "Level up! You are now level {L}. HP fully restored.", and emit a `levelUp` event so the presentation can play the short effect. [FR-PRO-2]

2.4 WHEN XP sources are applied THE SYSTEM SHALL use wisp 5, chest 10, monster `15 × tier`, and boss 100. [FR-PRO-1]

### Requirement 3: Streak Aura and weekday trait

**User story:** As a streak keeper, I want my streak and the shape of my week to change my hero, so that my habits show up in the game.

#### Acceptance criteria

3.1 WHEN the aura is computed THE SYSTEM SHALL use `min(floor(streak / 7), 4)` with the streak over the full year of the hero set. Starting ATK and max HP SHALL never decrease as the streak grows and SHALL stop growing at tier 4. [PRD Story 4, P6]

3.2 WHEN `total91 === 0` THE SYSTEM SHALL give the trait "Blank Slate", text "+5 max HP. Every quest starts somewhere.", no rows, `hp: 5`. [Weekday trait, P11]

3.3 WHEN Sunday and Saturday sums together are at least 40% of `total91` THE SYSTEM SHALL give "Weekend Warrior", text "+2 ATK when fighting in the Saturday and Sunday rows.", rows `[0, 6]`, `hp: 0`. [Weekday trait, P11]

3.4 OTHERWISE THE SYSTEM SHALL give "{Weekday} Slayer" for the weekday with the highest summed count (ties go to the earlier weekday, Sunday first), text "{Weekday} is your busiest day: +2 ATK when fighting in the {Weekday} row.", rows `[w]`, `hp: 0`. [Weekday trait, P11]

### Requirement 4: Wisps and chests

**User story:** As a player, I want small rewards between fights, and a chest when I need to heal.

#### Acceptance criteria

4.1 WHEN the hero enters an unresolved wisp THE SYSTEM SHALL mark it resolved, add 1 to `wisps`, log "A soul wisp from {fmtShort(date)} ({count} contribution{s}): +5 XP." ("s" unless the count is 1), emit a `wisp` event, and gain 5 XP. [FR-PRO-1]

4.2 WHEN the hero enters an unresolved chest THE SYSTEM SHALL mark it resolved, add 1 to `chests`, heal `ceil(maxHp × 0.3)` up to max HP, add 6 treasure (size 1) or 12 (size 2), log "A chest from {fmtShort(date)}: +{gold} treasure{, +{healed} HP}, +10 XP." (the HP part only when HP rose), emit a `chest` event with the gold and HP healed, gain 10 XP, then offer a relic (requirement 6.1), in that order. [FR-PRO-1, FR-REL-1]

### Requirement 5: Races

**User story:** As a player, I want to choose who my hero is, with one passive that changes how I play.

#### Acceptance criteria

5.1 WHEN the summary offers races THE SYSTEM SHALL provide Human (default), Elf, Orc, Skeleton, and Vampire with the prototype's `RACES` names and texts: "Adaptable: +10% XP from everything.", "Keen Eyes: the Perfect timing window is 15 ms wider.", "Brute: +2 ATK.", "Undying: once per run, a lethal hit leaves you at 1 HP.", "Bloodthirst: every critical hit heals 2 HP.". [FR-RACE-1, FR-RACE-2]

5.2 WHEN the player chooses a race while `steps === 0` THE SYSTEM SHALL set it, recompute stats, heal to full, and emit a `raceChosen` event so `main.ts` saves `heroRace` in settings; WHEN `steps > 0` THE SYSTEM SHALL refuse the change. [FR-RACE-1]

5.3 WHEN race passives apply THE SYSTEM SHALL apply Human (+10% XP, requirement 2.2) and Orc (+2 ATK, combat-timing requirement 3.3) here; Elf, Skeleton, and Vampire are applied by combat-timing requirements 6.1, 15.5, and 15.2. [FR-RACE-2]

5.4 WHEN speech lines are requested THE SYSTEM SHALL provide each race's two lines exactly as in `RACES` (Human "Coffee first, then commits." / "Just one more feature."; Elf "I can see your off-by-one from here." / "Tabs. Always tabs."; Orc "SMASH THE BUGS!" / "Me no read docs."; Skeleton "I came back for the bugs." / "Legacy code? I AM legacy."; Vampire "I only code after midnight." / "Your commits look... delicious."). [FR-RACE-4]

### Requirement 6: Relics

**User story:** As a player, I want each chest to offer a choice of relics, so that each run builds differently.

#### Acceptance criteria

6.1 WHEN a relic is offered THE SYSTEM SHALL take every unowned relic in `RELICS` order, shuffle the list with Fisher-Yates using the run RNG (`for i from len − 1 down to 1: j = floor(rand() × (i + 1))`), keep the first three, set `relicOffer` to their ids, `relicTitle` to the given title or "The chest holds a relic. Choose one.", `status` to `relic`, and emit a `relicOffer` event. [FR-REL-1, P17]

6.2 WHEN every relic is owned THE SYSTEM SHALL make no offer, draw nothing from the RNG, and leave `status` unchanged. [FR-REL-1, P17]

6.3 WHILE `status` is `relic` THE SYSTEM SHALL accept only `pickRelic` with index 0, 1, or 2 that exists in the offer; every other gameplay action is ignored. [FR-REL-1]

6.4 WHEN a relic is picked THE SYSTEM SHALL add its id to `relics`, clear the offer, set `status` to `exploring`, recompute stats, heal 10 for Cold Brew, clamp HP to max HP, reveal the wider radius for Code Review, log "Relic: {name}. {text}", and emit a `relicPicked` event. [FR-REL-1, FR-REL-4]

6.5 WHEN relics are listed THE SYSTEM SHALL use exactly the ids, names, and texts of the prototype's `RELICS`: `duck` Rubber Duck, `hotfix` Hotfix, `force` Force Push, `linter` Linter, `stack` Stack Overflow, `coffee` Cold Brew, `blame` Git Blame, `pair` Pair Programmer, `review` Code Review, `cache` CI Cache. [FR-REL-1, FR-REL-2]

6.6 WHEN a relic is owned THE SYSTEM SHALL keep it in `hero.relics` (saved with the run) so the HUD, the results screen, and the share card can list it. Owning any relic SHALL never lower a damage-dealt value or raise a damage-taken value. [FR-REL-4, FR-REL-2, FR-REL-3]

### Requirement 7: Daily omen

**User story:** As a developer, I want today's contribution to matter at the start of the run, so that committing today has a visible reward.

#### Acceptance criteria

7.1 WHEN a run starts THE SYSTEM SHALL set `hero.omen` to `blessed` if today's tile has at least one contribution, otherwise `cursed`, and set `pendingBlessing` to true only when blessed. [FR-OMEN-1]

7.2 WHEN the map screen is entered (`enterMap`) WHILE `pendingBlessing` is true and `status` is `exploring` THE SYSTEM SHALL set `pendingBlessing` to false and emit `blessingDue`; WHEN `offerBlessing` arrives later WHILE `status` is `exploring` THE SYSTEM SHALL offer a relic with the title "Commit Blessing: you contributed today. Choose a relic.", otherwise do nothing. [FR-OMEN-2]

7.3 WHEN the omen is logged at run start THE SYSTEM SHALL log "Commit Blessing: {hero username} contributed today, so a relic awaits." or "Uncommitted Curse: no contributions today, so monsters hit 15% harder. Commit to lift it." [FR-OMEN-3]

7.4 WHEN the run is saved THE SYSTEM SHALL save the omen and `pendingBlessing` with it. The curse multiplier on monster damage is applied by combat-timing requirement 2.1. [FR-OMEN-3, FR-OMEN-2]

### Requirement 8: End of a run

**User story:** As a player, I want a results screen that shows what I did next to the GitHub numbers it came from.

#### Acceptance criteria

8.1 WHEN combat-timing ends the run as won or lost THE SYSTEM SHALL set `status`, keep `killer` on a loss, and emit `runEnded` with the outcome. [FR-PRO-3, FR-COM-4]

8.2 WHEN the results are shown THE SYSTEM SHALL provide the title "The Gate opens. Your graph is exorcised." (won) or "You became part of the graph." (lost), and the line "{map username} survived 91 haunted days." or "Slain by {killer}. The same map is waiting for a rematch." [FR-PRO-4]

8.3 WHEN the results are shown THE SYSTEM SHALL provide the game rows Class, Final level, XP, Monsters banished, Critical hits, Perfect dodges, Chests opened, Relics (names joined by ", ", or "None"), Treasure, Steps. [FR-PRO-4, FR-REL-4]

8.4 WHEN the results are shown THE SYSTEM SHALL provide the GitHub rows from the map set: "Contributions (91 days)" (`total91`), "Active days" ("{n} of 91"), "Current streak" ("{streak} days"), "Best day" ("{count} on {fmtShort(date)}", the latest day with the highest count), "Year total". [FR-PRO-4]

8.5 WHEN the results are shown THE SYSTEM SHALL provide the today line from today's tile: "Today's tile is already glowing ({n} contribution{s}). Tomorrow your graph grows by one more day." if it has contributions, otherwise "Today's tile is still dark. Commit something and come back tomorrow: your map will be different." [FR-PRO-4]

### Requirement 9: Trophies

**User story:** As a returning player, I want trophies that remember what I have done in this browser.

#### Acceptance criteria

9.1 WHEN a run ends THE SYSTEM SHALL compute the facts `won`, `raid` (heroSet present), `source` (map set), `omen`, `bossDown`, `bossDmg`, `bossHpLeft`, `dodges`, `crits`, `relics` (count), `steps`, `chests`, `classWins`, and `nightmare` (class difficulty has 4 stars). [FR-TRO-1]

9.2 WHEN the run is won THE SYSTEM SHALL add the hero's class to the stored class wins (`cq:v1:classwins`) before computing `classWins` as the number of known class ids stored. [FR-TRO-1]

9.3 WHEN trophies are awarded THE SYSTEM SHALL test each of the 14 trophies in the prototype's order and wording (game-rules.md "Trophies") and add every one not yet held whose test passes, with today's date as `YYYY-MM-DD`, to `cq:v1:trophies`, returning the new ids in order. Held trophies are never removed or re-dated. [FR-TRO-1]

9.4 WHEN the new ids are known THE SYSTEM SHALL store them in the run (`newTrophies`) so the results screen can mark them. [FR-TRO-2]

9.5 WHEN the results screen lists trophies THE SYSTEM SHALL provide the heading "TROPHIES {held}/14", with " · {k} NEW" when k > 0, and each trophy's name, text, held flag, and new flag. [FR-TRO-2]

9.6 WHEN the start screen is shown and at least one trophy is held THE SYSTEM SHALL provide "Trophies earned in this browser: {n} of 14"; otherwise an empty line. [FR-TRO-3]

### Requirement 10: Save and continue

**User story:** As a player who closes the tab, I want to pick up my run where I left it.

#### Acceptance criteria

10.1 WHEN `main.ts` applies any action other than `press`, `release`, or `timeout` THE SYSTEM SHALL write `serialize(state)` to `cq:v1:run`. This covers every resolved tile, relic pick, fight end, and run end. [FR-SAV-1]

10.2 WHEN a run is serialized THE SYSTEM SHALL write plain JSON with `version: 1`, the map set and raid hero set (91 normalized days each, never the raw API payload), the map tiles without any derived grid, and every run field except the per-step `events`. [FR-SAV-1, P8, P19]

10.3 WHEN a save is restored THE SYSTEM SHALL validate it with a Zod schema; a save that fails the schema, has a version other than 1, or is not JSON (including a save written by the prototype at `/prototype/`, which shares the origin and the key) SHALL be discarded as "no save", never thrown on. [FR-SAV-1]

10.4 WHEN a valid save is restored THE SYSTEM SHALL return a state equal to the saved one with `events: []`, except that a fight in the `test` phase resumes at `choose` (combat-timing requirement 19.3). [FR-SAV-1, FR-COM-7, P8, P19]

10.5 WHEN the start screen loads and a valid save exists THE SYSTEM SHALL offer "Continue {map username}'s run"; choosing it SHALL open the results screen for a won or lost run, and otherwise the map without the rise animation. [FR-SAV-1]

### Requirement 11: New run and retry

**User story:** As a player, I want to replay the same graph at once, or start over with another name.

#### Acceptance criteria

11.1 WHEN the player chooses "Play this graph again" THE SYSTEM SHALL start a new run on the same map set and hero set from memory, with the current settings and no fetch, save it, and enter the map with the rise animation. [FR-SAV-3, FR-COM-4]

11.2 WHEN the player chooses "New username" on the results screen or "Different username" on the summary THE SYSTEM SHALL remove `cq:v1:run`, drop the run from memory, hide the continue button, and show the start screen with the username field focused. [FR-SAV-3]

### Requirement 12: Privacy

**User story:** As a player, I want to know exactly what leaves my browser.

#### Acceptance criteria

12.1 WHILE the game runs THE SYSTEM SHALL send network requests only to the contribution API (`API_BASE`) and the avatar URL `https://github.com/{username}.png`; no ContribQuest server, analytics, or cookie exists. [FR-SAV-2]

12.2 WHEN the start screen is shown THE SYSTEM SHALL show the line "Your username is sent to a public community API that reads your contribution calendar. Nothing else leaves your browser." [FR-SAV-2]

### Requirement 13: Hero-summary facts

**User story:** As a player, I want the summary to show how my numbers became my hero.

#### Acceptance criteria

13.1 WHEN the summary is shown THE SYSTEM SHALL provide the range line "{fmtDate(first)} to {fmtDate(last)} · {demo data | cached data | live data}", the identity "{RACE} {CLASS}" in upper case, and the aura label "STREAK AURA · TIER {n}" or "NO AURA YET". [FR-IMP-4, FR-MAP-1]

13.2 WHEN the summary is shown THE SYSTEM SHALL provide the stat rows of the prototype's `showSummary`: "Contributions, last 91 days" (`total91`, "gives {round(15√total91)} starting XP"); "Starting level" (level, "of 10"); "Current streak" ("{n} day{s}", "aura: +{a} ATK, +{5a} HP" or "reach 7 days for an aura"); "Hero" ("{maxHp} HP", "{atk} ATK"); "Your best day (the boss)" (count, `fmtDate`); "Year total" (`yearTotal`, "contributions"). [FR-IMP-4, PRD Story 4]

13.3 WHEN the summary is shown THE SYSTEM SHALL provide the trait name and text, the XP table "XP per level: L1 0 … L10 2250" with the current level marked, and, for a quiet map, "A quiet graph. Few spirits stir here, so some lost ghosts have risen from your empty days." [FR-PRO-2, Weekday trait]

13.4 WHEN the summary is shown THE SYSTEM SHALL provide the omen box: "Today's tile ({fmtDate(today)})", "Commit Blessing" or "Uncommitted Curse", and "{n} contribution{s} today. You start the run with a free relic." or "No contributions yet today, so monsters hit 15% harder. Commit something, then come back for the blessing." [FR-OMEN-3]

### Requirement 14: Balance simulator

**User story:** As the developer, I want win rates per class and skill measured over hundreds of seeds, so that balance is checked on every engine change.

#### Acceptance criteria

14.1 WHEN the simulator plays a run THE SYSTEM SHALL drive only `step`, answer every timing test with `forceGrade(skillGrade(test, bot))` (combat-timing requirement 21), send `advance` at once, pick the first relic offered, claim the Commit Blessing, never flee, and stop at `won`, `lost`, or 2000 actions (counted as lost). [FR-DIF-1, FR-REL-1]

14.2 WHEN the simulator chooses where to walk THE SYSTEM SHALL follow the PRD v1.2 route rule: if HP is below 45% of max HP (75% once the ward is broken and the boss is next) and an unresolved chest is reachable, go to the nearest one; else, while shards are missing, go to the nearest unresolved Ghoul or Lich; else to the boss; after the boss, to the Gate. "Nearest" is the fewest steps by BFS over walkable tiles, ties broken by the mapgen `neighbours` order; every tile on the path is entered. [FR-PRO-1, FR-PRO-3]

14.3 WHEN `npm run simulate` runs THE SYSTEM SHALL play 200 bot seeds for each target cell (Knight σ 140; Wanderer σ 100; Mage σ 100 and σ 60; Rogue σ 60 and σ 35) on the demo graph and the six balance fixtures, print win rates per graph and overall per cell next to the targets in `game-rules.md`, and exit with code 1 if any overall target is missed. [FR-DIF-1]

14.4 WHEN the simulator runs the Wanderer grade-policy regression on the demo graph THE SYSTEM SHALL check that All Perfect wins, All Good wins, Mixed (25% Perfect, 50% Good, 25% Miss from `makeRng(1234)`) wins, and All Miss loses, and print steps and fights for the demo route against the 15–25 steps and 6–10 fights target. [FR-COM-5, FR-PRO-1]
