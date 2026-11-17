# Product Requirements Document — ContribQuest

| Field | Detail |
| --- | --- |
| Product | ContribQuest: The Haunted Graph |
| Document type | Product Requirements Document (PRD) |
| Version | 1.4 — adds monster attack patterns, boss phase 2, and relics; v1.3 added timing tests (QTE) to every combat action; v1.2 added fog of war, soul shards, weekday traits, and challenge links |
| Status | Ready to start the build on Tue 17 Nov 2026 |
| Preview | `prototype/index.html`: a single-file vibe-coded prototype used to test the design (not the submission code) |
| Competition | Kiroween 2026, hosted on Devpost (https://kiroween.devpost.com/) |
| Category | Frankenstein (one category per submission) |
| Submission deadline | Fri 4 Dec 2026, 14:00 Pacific Time = **Sat 5 Dec 2026, 05:00 WIB**. No extensions, no edits after the deadline |
| Internal submit target | **Thu 3 Dec 2026, 21:00 WIB** (32 hours of buffer) |
| Kiro credit form | 4,000 credits, one request per person. Form closes Tue 1 Dec 12:00 PT = **Wed 2 Dec 03:00 WIB**. Codes arrive within 48 business hours, must be redeemed by 4 Dec PT, and expire 31 Dec 2026 |
| Judging period | 16 Dec 2026 – 29 Jan 2027 (PT). The hosted app must stay online and unchanged for this whole period |
| Eligibility | Built from scratch between 30 Oct and 4 Dec 2026. Frameworks, libraries, and asset packs are allowed; any other pre-existing code must be declared |
| Team | Solo build (decided 16 Nov 2026) |
| Platform | Static web application, no backend |

## What changed in v1.4

Two additions that make each fight and each run play differently, both tied to the developer-horror theme.

**Monster attack patterns.** Each monster's dodge test now matches its name. All patterns still use one button, so they work on keyboard and touch.

| Monster | Pattern | Rule |
| --- | --- | --- |
| Lost Ghost | Normal | One ring, as in v1.3 |
| Bug Imp | Double strike | A normal strike, then a fast one (640 ms to impact). Each hit deals ×0.6 damage |
| Flaky Test Ghoul | Flaky (65% of its strikes) | The ring freezes for 320–540 ms at 40–65% of its path, then finishes. Pressing at the original pace is too early |
| Merge Conflict Lich | Conflict (65% of its strikes) | A dashed decoy ring lands 300–420 ms before or after the solid ring. Only the solid ring is graded |
| The Phantom, phase 1 | Normal, then flaky | Two strikes per turn |
| The Phantom, phase 2 (below 50% HP) | Conflict, flaky, quick | Three strikes per turn, 15% faster, each hit ×0.75 damage. Red stage tint, faster heartbeat, "PHASE 2" banner |

**Relics.** Every chest offers three relics drawn with the run's seeded RNG; the player keeps one. Each relic can be owned once, they are shown in the HUD and on the results screen, and they are saved with the run.

| Relic | Effect |
| --- | --- |
| Rubber Duck | The first Miss in each fight counts as Good |
| Hotfix | Every perfect dodge heals 6% of max HP |
| Force Push | Critical ×2.0 instead of ×1.6 |
| Linter | Perfect window +25 ms |
| Stack Overflow | +3 ATK |
| Cold Brew | +10 max HP and heal 10 |
| Git Blame | Counter-attack 100% ATK instead of 50% |
| Pair Programmer | Glancing blow ×0.8 instead of ×0.5 |
| Code Review | Lantern reveal radius √8 instead of √5, and a wider light |
| CI Cache | Fleeing with a Good press takes no damage |

Balance check in the preview (17 Nov 2026, demo run, bot auto-picks the first relic offered): All Perfect, All Good, and Mixed still win; All Miss still loses to a Merge Conflict Lich. Real keyboard input was graded as designed: pressing a flaky ring at its original pace gave "TOO EARLY · HIT!", waiting out the pause gave "PERFECT DODGE!", pressing on the decoy gave a miss, and pressing on the solid ring gave "PERFECT DODGE!".

New property tests to add in the build: the flaky target always equals base time plus pause; the decoy never lies within the Good window of the real target; a relic offer never contains an owned relic or a duplicate; owning any relic never lowers a damage-dealt or raises a damage-taken value.

## What changed in v1.3

Every combat action is now a timing test (QTE), chosen over real-time action combat because it keeps the turn-based engine, its bot, and its property tests, and costs about one day instead of three to seven.

- **Strike:** press in the gold zone for a critical (×1.6); a miss is a glancing blow (×0.5).
- **Dodge:** every monster strike, including the boss's two-strike combo and the parting strike when fleeing, is a shrinking ring. Only a Perfect press avoids all damage and triggers a counter-attack. Good blocks most of it.
- **Data tie-in:** the Streak Aura widens the Perfect window by 10 ms per tier, and higher-tier days strike faster.
- **Accessibility:** Calm mode (×1.6 slower and wider) and Auto-timing (every test counts as Good) on the hero summary screen.
- **Results:** critical hits and perfect dodges are counted on the results screen and in the challenge link text.

Full rules are in "Timing tests (QTE)" under Combat design.

## What changed in v1.2

These four additions came out of playing the preview. Each one ties a mechanic to the player's real data, which helps the Innovation score, and none needs a new system.

| Addition | Rule | Why it makes the game more interesting |
| --- | --- | --- |
| Fog of war with a lantern | Tiles within radius √5 of the hero are revealed and stay revealed. Unrevealed tiles still show their green shade but hide what the day became. The boss, Gate, and start are always visible | You can see where your busy days are, but not whether a busy day is a chest or a Lich. Routing becomes a choice, and the graph stays recognizable |
| Soul shards | The boss is warded until the hero banishes `min(3, number of level-3/4 monsters)` elites (Ghouls or Liches). Each elite drops one shard. The HUD shows `Soul shards x/3` | Without it, the shortest route in the demo was 14 steps and 4 fights, and the hero walked past most of the graph. With shards, the demo run is 22 steps and 8 fights, inside the 15–25 / 6–10 target. Your other big days now matter |
| Weekday trait | Your busiest weekday over the 91 days gives +2 ATK when fighting in that weekday's row (for example "Friday Slayer"). If Saturday and Sunday make up ≥ 40% of contributions: "Weekend Warrior" for both rows. An all-empty profile gets "Blank Slate" (+5 max HP) | It uses the calendar's row layout as a mechanic, so the shape of your week matters, not only the totals |
| Challenge link | The results screen copies `?u=<username>` plus a one-line taunt. Friends who open it play your graph | A cheap sharing loop for the Social Blitz post and for demo viewers |

Balance changes from the preview: the boss gets ×1.4 HP, and fleeing can no longer kill the hero (HP stops at 1). With these, a bot that heals to 75% before the boss wins the demo run (boss fight 61 → 40 HP at level 5). A bot that walks into the boss at about 45% HP loses. Both results are intended.

## What changed from v1.0

| Area | v1.0 | v1.1 | Why |
| --- | --- | --- | --- |
| Judging alignment | Not mapped | New section mapping every feature and deliverable to the 5 official criteria (20% each) | Judging is two stages: a pass/fail check on category fit and Kiro use, then Potential Impact, Technological Implementation, Design, Innovation/Idea, and Presentation |
| Halloween theme | None | A haunted-graph theme: empty days are graveyard fog, monsters are developer horrors, your best day is the boss | It costs little (names, palette, sprites) and lifts Design and Presentation. v1.0 had no Kiroween flavor at all |
| Data source | Open question #1, Phase 0 spike | **Decided and verified on 16 Nov 2026** (see Data source decision) | Removes the biggest schedule risk before the build starts |
| Intensity bands | Thresholds "decided during implementation" | Use the `level` 0–4 field GitHub already computes for each day | GitHub's own shading is already relative to each user, so a modest profile still produces a varied map |
| Map layout | "Left to right, top to bottom" | The exact GitHub calendar layout: 7 rows (Sun–Sat) by 13–14 week columns, 91 days | The map is instantly recognizable, and a connected grid makes the path guarantee trivial |
| Run length | Every active day is a fight | Level-1 days become walk-over pickups; the required goal is boss + gate | A 91-tile map with 40+ fights cannot be shown in under 3 minutes |
| Streak bonus | Adds levels on top of XP levels | "Streak Aura": adds ATK and max HP only, never levels | Level stays one number derived from one XP table, which is easier to explain and test |
| Healing | Undecided, items post-MVP | Chests heal 30% max HP, level-ups heal fully, no inventory | Makes runs winnable without building an item system |
| Balance | "Tuned in Phase 3" | Starting constants, target outcomes, and a headless balance simulator | Phase 3 starts from numbers instead of a blank page |
| Testing | Example-based tests | Property-based tests (fast-check) on the map generator and engine | PBT is named explicitly in the official write-up prompts |
| Kiro evidence | Specs, steering, hooks | Plus custom agent, MCP via Kiro powers (Playwright), PBT, and a build journal | The write-up prompts ask about IDE/CLI/Web/Crew, custom agents, hooks, specs vs vibe coding, steering, MCP, PBT, and powers |
| Privacy claim | "No data sent to any server" | Discloses that the username is sent to a third-party community API | The v1.0 claim was false for the chosen data source |
| Prior art | Not mentioned | Named competitors and a stated differentiator | Similar projects exist and judges score Innovation |
| Timeline | Phase 5 on the last day | Feature freeze Tue 1 Dec, submit Thu 3 Dec, blog and social posts included | Avoids a last-night submission and captures bonus prizes |
| Compliance | Partial | YouTube upload, English materials, OSI license visible in the repo About panel, no third-party trademarks or copyrighted music in the video | These are official requirements; some are disqualifying if missed |

## Executive summary

ContribQuest is a browser-based retro pixel-art RPG that raises a GitHub contribution graph from the dead as a playable haunted map. The player enters a public GitHub username, and the last 91 days of their calendar become a 7-by-13 grid of tiles laid out exactly like the GitHub graph. Busy days spawn monsters and treasure, empty days become graveyard fog, the player's single best day becomes the boss, and their current streak powers the hero with a visible aura.

The product bet is deliberately narrow: one polished core loop that a judge understands from one sentence and one screen, and that can be shown end to end in a video under three minutes. Feature breadth is sacrificed for a finished, submittable game.

ContribQuest is built from scratch for Kiroween 2026 with no code reused from earlier projects.

## Category statement for the credit and submission forms

> I'm building for the Frankenstein category. ContribQuest stitches a GitHub contribution calendar, a turn-based dungeon-crawler engine, and retro pixel-art rendering into one browser game. Your last 13 weeks of contributions rise from the dead as a haunted map: every day is a tile, busy days spawn monsters and treasure, your best day becomes the boss, and your streak powers your hero. It is built with Kiro specs, steering, hooks, and property-based tests.

## Judging alignment

Stage 1 is pass/fail: the project must fit the Frankenstein category and visibly use Kiro. Entries where judges find Kiro usage insufficient can be disqualified. Stage 2 scores five criteria, each out of 10 and each worth 20%.

| Criterion | What judges look for | How ContribQuest earns it | Where it is proven |
| --- | --- | --- | --- |
| Potential Impact | A real problem for real users, shown in the demo; useful, understandable, accessible | Turns a passive habit metric into a reason to return; zero setup; keyboard and touch; demo mode | Start screen, results screen "today's tile" message, video 0:00–0:15 |
| Technological Implementation | Depth and quality of Kiro use; a deliberate AI-assisted workflow; several Kiro features used well | 4 specs traced to FR IDs, steering with file-match inclusion, hooks that run real checks, PBT, a custom balance agent, Playwright via Kiro powers | `/.kiro`, `docs/kiro-journal.md`, write-up, video 2:25–2:55 |
| Design | A coherent product experience, not a tech demo; clear, polished, intentional | 5 focused screens, haunted pixel-art theme, colorblind-safe tile shapes, fast animations | The hosted app, video throughout |
| Innovation/Idea | Original; unusual combinations of technology or public data | Each day's real date and count become a specific monster; your best day is the boss; your streak is armor | Combat screen source label, write-up prior-art paragraph |
| Presentation | The video shows the app working end to end; clear who, what, why; memorable | A scripted 2:55 video with a "graph rises from the dead" moment and a boss fight | YouTube video |

The Best Demo bonus prize goes to the highest Presentation score among the top 10% of entries, so the video is worth real rehearsal time.

## Bonus prizes worth entering

| Prize | Requirement | Plan |
| --- | --- | --- |
| Bonus Blog Prize (2,000 Kiro credits, 100 winners) | A post on an external blog, published during the submission period, stating it was written for Kiroween 2026 | Publish on dev.to on Wed 2 Dec, built from `docs/kiro-journal.md` |
| Social Blitz Prize (Kiro Pro+ 3 months, 5 winners) | A social post starting with `#KiroweenHackathon26` about your favorite Kiro feature and how it changed your workflow, with good visuals | Post a 20-second GIF of the graph turning into the map, on Thu 3 Dec |
| Best Student Project (Frankenstein) | Every team member is a student; LinkedIn, student email, degree, and school required | Enter only if eligible. Confirm in Phase 0 |
| Best Demo | Automatic, from the Presentation score | Covered by the video plan |
| Best Kiro Crew App, Best Startup Project, Best Ghost of Kiroween Past | Separate eligibility | Not targeted |

## Product vision

Every developer already reads a GitHub contribution graph fluently. ContribQuest gives that grid a second life: it stops being a report about the past and becomes a world the player acts in. Consistency is rewarded visibly, gaps show as haunted fog, and a strong streak makes the hero stronger.

Beyond the hackathon, ContribQuest is a lightweight motivation layer for developers and students building a coding habit. The hackathon version only has to prove that one idea works.

## The problem

The contribution graph is passive. A developer glances at it, registers the total, and closes the tab. It gives no reason to return, no moment of achievement, and no consequence for a broken streak beyond a smaller number.

RPG progression (XP, levels, loot, streaks) is understood instantly and gives a direct feeling of accomplishment. ContribQuest uses real contribution data as the fuel of a game instead of a static statistic.

## Prior art and differentiation

Similar projects exist, and the write-up must name them rather than claim the idea is new:

- Animations and arcade games played on the graph, such as [Pac-Man Contribution Graph](https://github.com/abozanona/pacman-contribution-graph) (an SVG animation for profile READMEs) and browser extensions like [contrib-awakens](https://github.com/zhouzi/contrib-awakens) that run games inside the graph on the profile page.
- [Git Quest](https://dev.to/fcsouza/show-dev-i-turned-your-github-commit-history-into-an-idle-rpg-3j41), an idle RPG that builds a character from public GitHub history.

ContribQuest differs in one specific way: **each day keeps its meaning inside the game.** In the arcade projects the squares are just a board, and in the idle RPG the history becomes aggregate character stats. In ContribQuest the monster on a tile is labeled with the real date and contribution count that created it, the boss is the player's own best day, and the gaps in their history are visible as fog they walk through. The player explores their own last quarter, day by day.

## Why this is a Frankenstein project

ContribQuest stitches together parts that do not normally live in one application:

1. **A data-visualization source:** the GitHub contribution calendar, read through a public community API.
2. **A game engine:** a tile map, movement, encounters, turn-based combat, and RPG progression.
3. **A retro rendering layer:** pixel-art sprites and 8-bit presentation on Canvas 2D.

Removing any one part breaks the product. Without the calendar there is no map; without the engine there is nothing to play; without the grid-faithful rendering the map no longer reads as your contribution graph.

Kiro is how the chimera is built, not one of its parts. Every entry uses Kiro, so the write-up describes Kiro under Technological Implementation rather than as a stitched component.

## Product goals

- Make a contribution graph playable within 10 seconds of entering a username, and within 1 click from the start screen in demo mode.
- Make the link between real contributions and in-game power explicit: contributions seed XP, the streak grants an aura, and each day decides what fills its tile.
- Ship a working hosted app, a public repository with `/.kiro`, a YouTube video under three minutes, and a write-up describing how Kiro was used.
- Keep the scope small and finished.

## Non-goals for the first version

- No repository management or GitHub client features.
- No multiplayer, leaderboards, or player-versus-player.
- No login or token.
- No monetization, inventory, or in-game economy.
- No Kiro Crew app.
- No reuse of pre-existing code beyond declared libraries and asset packs.

## Success metrics for the submission

| Metric | Target |
| --- | --- |
| Username input to playable map | Under 3 s on a typical connection; hard limit 10 s, after which the error screen offers demo mode |
| Demo dataset run length | 15–25 steps and 6–10 fights on the intended route, about 2 minutes of play |
| Map validity | 100% of property-test cases and all fixture profiles produce a valid map |
| Run completion | The balance simulator's bot wins every fixture profile |
| Demo resilience | The full game works with the network disabled, in demo mode |
| First-screen comprehension | A first-time viewer can say what the app does after the start screen and one map screen (check with 2–3 friends in Phase 4) |
| Submission completeness | Every item in the submission checklist is ticked by Thu 3 Dec 21:00 WIB |

## Target users and personas

**Primary users** are developers, students, and bootcamp participants with a GitHub account who care about consistency. **Secondary users** are judges and demo viewers, who may never type a username, so demo mode and the start screen carry the explanation for them.

- **The streak keeper** commits almost daily. Their streak is a visible aura, and breaking it would visibly weaken the hero.
- **The habit-building student** has an empty start and a busy end to their quarter. Their map gets more crowded and dangerous toward the gate while the hero grows stronger across it.
- **The demo viewer** clicks "Play the demo" and judges the concept with no setup.

## Jobs to be done

- When I check my GitHub profile, I want my consistency to feel like an achievement, so I stay motivated to contribute tomorrow.
- When I share my work with other developers, I want a playful artifact that represents it.
- When I judge this entry, I want to understand and test the core idea in under three minutes, with no setup.

## User stories and acceptance criteria

**Story 1 — Generate my own map.** As a developer, I want to enter my GitHub username so that my map is generated from my own contributions.

- Entering a valid public username and pressing start shows a loading state, then the hero summary, then the map.
- The summary shows the username, avatar, 91-day total, current streak, starting level, starting HP, and the aura bonus in numbers.
- An unknown or invalid username produces a readable error and a one-click switch to demo mode.
- Opening `/?u=<username>` skips the form and starts loading that profile.

**Story 2 — Feel my data come alive.** As a player, I want to face monsters spawned by my active days.

- Every encounter screen shows the source date and contribution count, for example "Risen from Tue 3 Nov 2026 — 14 contributions".
- Higher-level days produce visibly stronger monsters.

**Story 3 — Earn a sense of completion.** As a player, I want to collect treasure and XP so that finishing feels like an achievement.

- Fights, chests, and wisps grant XP; treasure is always visible in the HUD.
- The results screen shows game statistics next to the original GitHub statistics.

**Story 4 — Be rewarded for my streak.** As a streak keeper, I want my streak to strengthen my hero.

- The hero summary states the streak, the aura tier, and the exact ATK and HP it adds.
- Two profiles with equal totals but different streaks produce different starting ATK and HP (covered by a property test).

**Story 5 — Try it with no account.** As a demo viewer, I want to play without entering a username.

- "Play the demo" is on the start screen and `/?demo` opens it directly.
- Demo mode makes no network request to any data source.
- A full demo run (start, map, combat, boss, results) is possible without interruption.

## Glossary

| Term | Meaning in ContribQuest |
| --- | --- |
| Contribution day | One calendar day with a date, a contribution count, and a level |
| Level (day) | GitHub's own 0–4 shading for that day, returned by the data source |
| Tile | One map cell, generated from exactly one contribution day, or a void padding cell |
| Void cell | An unwalkable padding cell before the first day or after the last day in the week grid |
| Encounter | A monster, chest, wisp, boss, or gate on a tile |
| Run | One play session, from map generation to victory or game over |
| Streak | Consecutive days with at least one contribution, ending at the last day (or the day before, if the last day has 0) |
| Streak Aura | The ATK and max-HP bonus granted by the streak |
| Hero level | The level derived from XP using one fixed threshold table |
| HUD | Heads-up display: HP, hero level, XP, treasure, boss status |
| Demo mode | A frozen built-in dataset with exactly the same shape as live data |
| Spec | A Kiro spec (requirements, design, tasks) for one feature |
| PBT | Property-based testing: tests that check a rule over many generated inputs |

## Theme: the haunted graph

The theme is applied through names, palette, and sprites only. It adds no new mechanics.

| Game element | Data source | Themed as |
| --- | --- | --- |
| Map | Last 91 days | The Haunted Graph |
| Level 0 day | No contributions | Graveyard fog, occasional gravestone decoration (always walkable) |
| Level 1 day | Few contributions | Soul wisp: walk over it to collect XP, no fight |
| Level 2 day | | Bug Imp, or a small chest |
| Level 3 day | | Flaky Test Ghoul, or a stocked chest |
| Level 4 day | Top shading | Merge Conflict Lich (elite) |
| Best day of the 91 | Highest count | The boss: "The Phantom of {date}" |
| Filler monster on an empty day | Shortfall rule | Lost Ghost, labeled "risen from an empty day" |
| First day | | The crypt where the hero wakes |
| Last day | | The Gate, sealed until the boss falls |
| Streak | Current streak | Streak Aura: a glow around the hero, brighter per tier |

Tone: playful and spooky, never gory. Copy examples: "Your graph is haunted." "14 contributions rose from the grave on Tue 3 Nov." "The Gate is sealed. Defeat the Phantom of your best day."

## Core gameplay loop

1. The player enters a username, opens a `?u=` link, or chooses demo mode.
2. The app fetches the calendar and shows the hero summary.
3. The graph "rises": the flat GitHub-style calendar animates into the haunted map (about 1.5 s, skippable, disabled with reduced motion).
4. The player explores with arrow keys, WASD, or the on-screen D-pad.
5. Wisps and chests resolve instantly when entered. Monsters start turn-based combat: attack or flee.
6. Victories and pickups grant XP and treasure; level-ups heal fully.
7. Defeating the boss unseals the Gate. Entering the Gate ends the run with the results screen.

## Data source decision (decided 16 Nov 2026)

**Primary source:** the open-source community API [grubersjoe/github-contributions-api](https://github.com/grubersjoe/github-contributions-api), hosted at `github-contributions-api.jogruber.de`. It reads the public contribution calendar from the GitHub profile page and returns JSON.

Verified on 16 Nov 2026 from this environment:

- `GET https://github-contributions-api.jogruber.de/v4/torvalds?y=last` returned HTTP 200 with 366 days, from 2025-11-16 to 2026-11-16, each as `{ date, count, level }`, plus `total.lastYear`.
- The response carries `access-control-allow-origin: *`, so the browser can call it directly with no backend and no token.
- Rate limit header: 10 requests per 10 seconds. Responses are cached upstream (an `age` of about one hour was observed), so data can lag GitHub by up to an hour.
- An unknown user returns HTTP 404 with `{"error": "GitHub user \"…\" not found."}`.

**Fallbacks, in order:**

1. A cached copy of the last successful fetch for that username in local storage (1-hour freshness, used beyond that only if the live fetch fails, with a "cached data" label).
2. Demo mode, offered on every error screen.
3. Only if the primary source dies during the build: deploy [ncdai/github-contributions-api](https://github.com/ncdai/github-contributions-api), a Cloudflare Worker with the same response shape that uses the official GraphQL API and the project's own token. Not built unless needed.

**Optional enrichment (Could-have):** GitHub's REST endpoint `GET /users/{u}/events/public` works without a token and with CORS, and returns repository names for recent push events, but no commit messages. Its unauthenticated limit is 60 requests per hour per IP. It can name elites and the boss after the repository pushed to that day ("The Phantom of kiro-prd"). The avatar comes from `https://github.com/{u}.png` with no API call.

**Honesty rules for the write-up and README:** state that counts come from a community API that reads the public calendar, that private contributions appear only if the user shows them on their profile, that data may lag by up to an hour, and that the username is sent to that third-party service.

## Data-to-game mapping rules

These rules are frozen from the MVP onward and live in the steering file `game-rules.md`.

### Window and layout

- The window is the 91 days ending at the **last date in the API response**. The device clock is never used, which avoids timezone bugs.
- Days are laid out like the GitHub calendar: rows are weekdays Sunday (top) to Saturday (bottom), columns are weeks, oldest on the left. 91 days fill 13 or 14 columns.
- Cells before the first day in its column and after the last day in its column are void cells. Because void cells only occur at the top of the first column and the bottom of the last one, every day tile is connected.

### Tile assignment

| Day level | Tile | Fight? | Reward |
| --- | --- | --- | --- |
| 0 | Fog path (some get a gravestone decoration) | No | None |
| 1 | Soul wisp | No | Small XP |
| 2 | Bug Imp (2 in 3) or small chest (1 in 3) | Imp: yes | XP, treasure |
| 3 | Flaky Test Ghoul (2 in 3) or stocked chest (1 in 3) | Ghoul: yes | More XP, treasure, heal |
| 4 | Merge Conflict Lich | Yes | High XP, treasure |
| Best day | Boss (replaces the day's normal tile) | Yes | Largest XP and treasure; unseals the Gate |
| First day | Crypt (start) | No | — |
| Last day | Gate (finish) | Boss guard if the best day is also the last day | Ends the run |

The "1 in 3" choice is deterministic: `hash(date) % 3 === 0` means chest. All randomness comes from a seeded generator with seed `fnv1a(username + "|" + lastDate)`, so the same profile on the same day always produces the same map and the same combat rolls.

### Special cases

- **Ties for the best day:** the most recent date wins.
- **Best day is the first day:** use the next-best day, so the boss is never on the start tile.
- **Shortfall:** if fewer than 6 fight tiles exist (excluding the boss), convert seeded-random level-0 days into Lost Ghosts until there are 6. The hero summary labels the map "A quiet graph — few spirits stir here."
- **All-empty profile:** the boss becomes "The Phantom of the Empty Quarter" on the middle tile, and the shortfall rule fills the rest. The run is still winnable.
- **Validation before play:** the start, the Gate, and the boss exist; a walkable route exists (BFS); every day appears exactly once. If validation fails, show an error and offer demo mode. A broken map is never shown.

### Streak rules

- Computed over the full year returned by the API, not only the 91-day window.
- Counted backwards from the last day. If the last day has 0 contributions, counting starts from the day before, because today may not be over.

## Character progression

The same profile on the same day always produces the same starting hero. All constants live in one file, `src/engine/balance.ts`, so tuning never touches logic.

| Stat | Starting rule (v0 constants, tuned by the simulator) |
| --- | --- |
| Starting XP | `round(15 × √total91)`. The square root keeps very busy profiles from starting at the cap |
| Hero level | XP needed for level n is `25 × n × (n − 1)`: 0, 50, 150, 300, 500, 750, 1050, 1400, 1800, 2250. Cap at level 10. The table is shown on the hero summary |
| Aura tier | `min(floor(streak / 7), 4)`: one tier per full week of streak, capped at 4 weeks |
| Max HP | `30 + 6 × (level − 1) + 5 × auraTier` |
| ATK | `5 + 2 × (level − 1) + 1 × auraTier`, with ±20% seeded variance per hit |
| Healing | Chests heal 30% max HP. Level-ups heal fully. HP otherwise carries between fights |
| Treasure | A score only, shown in the HUD and on the results screen |

Examples: 10 contributions in 91 days gives 47 XP (level 1). 100 gives 150 XP (level 3). 1,000 gives 474 XP (level 4). A 15-day streak gives aura tier 2: +2 ATK and +10 HP.

## Combat design

- Turn-based. The hero acts first and chooses Attack (`A` / Enter) or Flee (`F`).
- Every action is a timing test (QTE). The player presses Space (or Enter, A, J, K, or the on-screen "Now!" button) at the right moment. See "Timing tests (QTE)" below.
- After the hero attacks, a surviving monster strikes back. The boss strikes twice per turn, and each strike is its own dodge test.
- Flee always succeeds. The monster gets one parting strike, defended with a dodge test. Fleeing never drops HP below 1 and leaves the monster in place.
- If the fight happens in the row of the hero's weekday trait, the hero's attacks get +2 ATK.
- Banishing a Ghoul or Lich drops a soul shard until the boss's ward is broken (see v1.2 changes).
- At 0 HP the run ends on the game-over screen. Retry restarts the same map from memory with no new fetch.
- The combat panel shows both sprites, both HP bars, the monster name, and the source label "Risen from {weekday date} — {count} contributions".
- Each fight should last 2–6 turns, about 10–15 seconds including timing tests, so a 3-minute video fits several.

### Timing tests (QTE)

| Test | What the player sees | Perfect | Good | Miss (too early, too late, or no press) |
| --- | --- | --- | --- | --- |
| Strike (on Attack) | A marker sweeps once across a bar with a green zone and a narrow gold centre. The zone's position is seeded per strike | Critical: ×1.6 damage | ×1.0 damage | Glancing blow: ×0.5 damage |
| Dodge (each monster strike, and the parting strike on Flee) | A red ring shrinks onto a gold circle around the target | No damage, plus a counter-attack for 50% ATK | Block: ×0.4 damage | Full damage |

Only a Perfect press avoids a hit completely. Pressing early ends the test as a miss, so mashing does not work. A press within the first 120 ms of a test is ignored so the key that chose Attack does not count.

| Timing rule | Value |
| --- | --- |
| Perfect window | ±70 ms around the target, +10 ms per Streak Aura tier (a 4-week streak gives ±110 ms) |
| Good window | ±170 ms |
| Strike bar sweep time | `1200 − 40 × tier` ms; the target sits 50–80% along the bar |
| Dodge ring time to impact | `1150 − 80 × tier` ms (Lost Ghost 1,070 ms, boss 750 ms) |
| Calm mode | All times and windows × 1.6 |
| Auto-timing (assist) | Every test resolves as Good at the target moment |

The streak now rewards skill as well as stats: consistent contributors get a wider Perfect window. Harder days strike faster.

| Monster | Tier t | HP | Damage | XP |
| --- | --- | --- | --- | --- |
| Lost Ghost (shortfall filler) | 1 | `round((5 + 7t) × f)` | `round((1 + t) × f × 1.25)` | `15 × t` |
| Bug Imp (level 2 day) | 2 | same formula | same formula | same formula |
| Flaky Test Ghoul (level 3 day) | 3 | same formula | same formula | same formula |
| Merge Conflict Lich (level 4 day) | 4 | same formula | same formula | same formula |
| Boss (best day) | 5 | formula × 1.4 | same formula | 100 |

`f = 1 + 0.12 × (startLevel − 1)` scales monsters partly to the profile, so a busy profile feels stronger without making every fight trivial. Wisps give 5 XP and chests give 10 XP.

Worked example for a start-level-3 hero (ATK 9, HP 42, f = 1.24): a Bug Imp has 24 HP and hits for 5 (2 on a block). A Lich has 41 HP and hits for 8 (3 on a block). The boss has 69 HP and hits twice per turn for 9 each (4 on a block). By the time the shards are collected the hero is usually level 4–5, so the boss costs roughly 20–35 HP.

Base damage is ×1.25 because blocking is now the normal outcome. A player who always gets Good takes about half the damage of the v1.2 design; one who always misses takes 25% more.

**Balance targets**, checked by `scripts/simulate-balance.ts` on every fixture. The simulator replaces the player's timing with a grade policy:

| Policy | Target | Demo result in the preview (17 Nov 2026) |
| --- | --- | --- |
| All Perfect | Wins easily | Won, level 6, 70/70 HP, 18 criticals, 10 perfect dodges |
| All Good | Wins if it heals before the boss | Won, level 6, entered the boss at 44/64 HP |
| Mixed (25% Perfect, 50% Good, 25% Miss) | Wins | Won, level 6, entered the boss at 47/64 HP |
| All Miss | Loses | Lost to a Merge Conflict Lich after 2 fights |

The bot follows the v1.2 route rule: collect shards, heal at chests below 45% HP (75% before the boss), then the boss and the Gate. A first try at 1.4× damage and 0.5× block lost the All Good run at the boss, which was too punishing for an average player.

## Functional requirements — MVP (must have)

### GitHub import

- **FR-IMP-1.** The start screen has one username field. Input is trimmed and validated against GitHub's username rule (1–39 characters, letters, digits, single hyphens, not starting or ending with a hyphen) before any request. The username is URL-encoded in the request.
- **FR-IMP-2.** A loading state names the username being loaded. A blank screen never appears.
- **FR-IMP-3.** Errors map to specific messages: invalid input, user not found (404), rate limited (429), and source unavailable (network, 5xx, or the 8 s timeout). Every error screen offers retry and demo mode.
- **FR-IMP-4.** The hero summary shows the username, avatar, 91-day total, year total, current streak, aura tier and bonus, starting level, starting HP, and starting ATK.
- **FR-IMP-5.** No token, login, or account is required.
- **FR-IMP-6.** `/?u=<username>` starts loading that profile; `/?demo` starts demo mode.
- **FR-IMP-7.** Successful responses are cached in local storage per lowercase username for 1 hour (see the fallback rules).

### Map generation

- **FR-MAP-1.** The map covers the 91 days ending at the last date in the data, and the summary displays that date range.
- **FR-MAP-2.** Every day maps to exactly one tile in the GitHub calendar layout; void cells pad the first and last columns.
- **FR-MAP-3.** Tile assignment follows the mapping rules and is deterministic for identical input.
- **FR-MAP-4.** The map always has a start, a boss, a Gate, and a walkable route between them, verified before play.

### Movement and exploration

- **FR-MOV-1.** Four-direction movement with arrow keys and WASD.
- **FR-MOV-2.** An on-screen D-pad appears on touch devices. (Moved into the MVP: it is about one hour of work, and judges may open the link on a phone.)
- **FR-MOV-3.** Entering a tile triggers its encounter. Entering the sealed Gate shows "Defeat the Phantom first" and does nothing else.
- **FR-MOV-4.** The HUD always shows HP, hero level, XP to next level, treasure, and boss status.
- **FR-MOV-5.** Visited and resolved tiles look different from unvisited tiles.
- **FR-MOV-6.** Fog of war: unrevealed tiles show only their green shade; the lantern reveals radius √5 around the hero; the start, boss, and Gate are always visible.
- **FR-MOV-7.** The HUD shows soul shards collected and needed. Entering a warded boss tile is refused with a message.

### Combat

- **FR-COM-1.** Combat offers Attack and Flee.
- **FR-COM-2.** Monster stats follow the tier of the source tile and the balance formulas.
- **FR-COM-3.** The combat view shows both HP values, the monster name, and the source date and count.
- **FR-COM-4.** At 0 HP the game-over screen offers a retry of the same map with no new fetch.
- **FR-COM-5.** Every Attack starts a strike test and every monster strike (including the Flee parting strike) starts a dodge test, graded Perfect, Good, or Miss using the windows in "Timing tests (QTE)". The grade appears on screen at once, for example "PERFECT DODGE!" or "TOO EARLY · HIT!".
- **FR-COM-6.** Timing tests accept Space, Enter, A, J, K, or a tap or click on the "Now!" button or the test itself. Grading uses the input event's timestamp, not the time it is processed.
- **FR-COM-7.** Calm mode and Auto-timing are on the hero summary screen and are saved in local storage. A timing test in progress when the page reloads is cancelled and the fight resumes at the Attack/Flee choice.

### Progression and run completion

- **FR-PRO-1.** XP comes from fights, chests, and wisps.
- **FR-PRO-2.** Hero level follows the displayed XP table; level-ups heal fully and show a short effect.
- **FR-PRO-3.** Defeating the boss unseals the Gate; entering the unsealed Gate shows the victory screen.
- **FR-PRO-4.** The results screen shows outcome, final level, XP, monsters defeated, critical hits, perfect dodges, treasure, steps taken, and the GitHub statistics the run came from, plus a "today's tile" line: if today has contributions, "Today's tile is already glowing"; if not, "Today's tile is still dark. Commit something and come back tomorrow."

### Persistence

- **FR-SAV-1.** Run state is saved to local storage under a versioned key (`cq:v1:run`) after every resolved tile and restored on reload. A save with an unknown version is discarded, not crashed on.
- **FR-SAV-2.** No ContribQuest server exists. The only network requests go to the contribution API (and, if built, the GitHub events API and avatar URL). This is disclosed on the start screen in one line.
- **FR-SAV-3.** "New run" clears the saved run and returns to the start screen.

### Demo mode

- **FR-DEM-1.** Demo mode uses a frozen dataset and needs no network.
- **FR-DEM-2.** Demo mode is the vehicle for the video backup take, testing, and fallback.
- **FR-DEM-3.** Demo data is stored in exactly the API's normalized shape and passes the same schema validator as live data.

## Scope after the MVP (MoSCoW)

Nothing below starts until every Must is checked against the hosted app. Each item is cut without discussion if it threatens the timeline.

| Priority | Feature | Effort | Value |
| --- | --- | --- | --- |
| Should | "Graph rises" intro animation from flat calendar to map | 3 h | The memorable video moment (Presentation, Design) |
| Should | Pixelated GitHub avatar on the hero summary | 1 h | Proves it's your data |
| Could | Name elites and the boss after the repository pushed that day (events API) | 4 h | Personalization, Innovation |
| Could | Self-made chiptune effects (step, hit, chest, victory) with mute | 3 h | Atmosphere. Never copyrighted music |
| Could | Share card: export the results as a PNG | 3 h | Social Blitz visuals |
| Won't (this version) | Selectable 30/365-day periods, classes, inventory, login, leaderboards | — | — |

## Non-functional requirements

- **Performance.** Map generation under 50 ms for 91 days. The game runs at 60 fps on a mid-range laptop. No animation blocks input for more than 300 ms.
- **Responsiveness.** Playable from 360 px wide. The map scales by integer factors and scrolls on narrow screens; the HUD and D-pad stay visible.
- **Accessibility.** Every action works by keyboard alone. Tile types differ by shape and icon, not only color. Numbers use a legible font. `prefers-reduced-motion` disables screen shake, flashes, and the intro animation; the timing-test animations stay because they are the game input. Timing tests are never the only way through: Calm mode slows them and Auto-timing removes the timing requirement for players who cannot use fast inputs. Text meets 4.5:1 contrast.
- **Reliability.** Every fetch or parse failure leads to a readable error with demo mode. All data is validated against a schema at the trust boundary before it reaches the generator.
- **Privacy.** No credentials, no analytics, no cookies. Only game state and a 1-hour data cache stay in the player's browser.
- **Browser support.** Current Chrome, Firefox, Safari, and Edge on desktop; Chrome and Safari on mobile.
- **Maintainability.** Data, map generation, engine, renderer, and storage are separate modules with pure functions at the core.
- **Availability during judging.** The hosted app stays live and frozen from the deadline until at least 30 Jan 2027.

## User experience and screens

1. **Start.** Title, the tagline "Your GitHub graph is haunted.", a username field, Start, "Play the demo", a looping 4-second preview of the graph turning into the map, a 3-line "how to play", and the one-line privacy note.
2. **Hero summary.** Pixel hero with aura, avatar, the statistics from FR-IMP-4, and the XP table. Primary action: "Enter the graph".
3. **Map.** The map fills most of the screen. The HUD is at the top, a 3-line event log at the bottom. Week labels above the columns and weekday labels on the side, as on GitHub, so the origin is unmistakable.
4. **Combat.** A panel over the map with both sprites, HP bars, the source label, Attack and Flee.
5. **Results.** Victory or defeat, statistics side by side with the GitHub numbers, the "today's tile" line, "Play again", and "New username".

Supporting states: loading, error, game over, and a how-to-play overlay readable in under 30 seconds.

## Visual direction

- **Palette.** A near-black background (`#0d1117`); four greens for day levels 1–4 that match the GitHub dark-mode shading; pumpkin orange for treasure and chests; spectral purple for ghosts and the boss; off-white text. The greens double as "ectoplasm", which suits the theme.
- **Fonts.** "Press Start 2P" (SIL Open Font License) for titles only. A legible sans-serif for statistics and body text.
- **Sprites.** 16×16 px, drawn at integer scale with image smoothing off. Higher tiers are larger or more detailed. Sources: self-drawn, or a CC0 pack (for example Kenney or 0x72's dungeon tileset), credited in the README and declared in the submission.
- **Trademarks.** No GitHub logo, no Octocat, and no GitHub UI screenshots inside the game or video. "GitHub" appears as plain text only, with a "not affiliated with GitHub" line in the footer and README.
- **Animation.** Short and fast: a 120 ms step, a hit flash, a chest pop, a level-up glow.

## Technology (decided)

| Layer | Choice | Reason |
| --- | --- | --- |
| Language | TypeScript (strict) | Catches data-shape mistakes at the API boundary; Kiro generates and reviews typed code well |
| Build | Vite | Fast dev server, static output, minimal config |
| Rendering | Canvas 2D, no game framework | 91 tiles do not need an engine; keeps the code small and fully understood |
| UI screens | Plain DOM over the canvas | Forms, buttons, and text stay accessible |
| Schema validation | Zod | One schema validates both live and demo data |
| Tests | Vitest + fast-check | Unit tests plus property-based tests |
| E2E smoke test | Playwright, run through the Kiro Playwright power | Plays the hosted `?demo` run and captures screenshots |
| Hosting | GitHub Pages, deployed by a GitHub Actions workflow | Same place as the repo; free; static |
| License | MIT, as `LICENSE` at the root so it shows in the repo About panel | Official requirement |

## Architecture

Data flows one way: **fetch → validate → normalize → generate map → engine → render.**

The engine is a pure reducer, `step(state, action) → state`, with all randomness drawn from the seeded generator stored in the state. This makes save and restore a plain JSON round-trip, and it lets property tests and the balance simulator run the whole game headlessly.

```
contribquest/
├── .kiro/
│   ├── specs/
│   │   ├── data-import/          requirements.md, design.md, tasks.md
│   │   ├── map-generation/
│   │   ├── gameplay/
│   │   └── combat-progression/
│   ├── steering/
│   │   ├── product.md            scope limits, non-goals, tone of voice
│   │   ├── tech.md               stack, commands, coding rules
│   │   ├── structure.md          module boundaries
│   │   ├── game-rules.md         mapping + balance rules (fileMatch: src/mapgen/**, src/engine/**)
│   │   └── art-style.md          palette, sprite scale, theme names (fileMatch: src/render/**)
│   └── hooks/                    see "Using Kiro"
├── src/
│   ├── data/      fetcher.ts, schema.ts, normalize.ts, cache.ts, demo-data.json
│   ├── mapgen/    layout.ts, assign.ts, validate.ts, rng.ts
│   ├── engine/    state.ts, step.ts, combat.ts, progression.ts, balance.ts
│   ├── render/    canvas.ts, sprites.ts, hud.ts, screens/
│   ├── storage/   save.ts
│   └── main.ts
├── tests/         fixtures/, *.test.ts, *.prop.test.ts, e2e/
├── scripts/       simulate-balance.ts, make-demo-data.ts
├── docs/          decision-log.md, kiro-journal.md, screenshots/
├── LICENSE
└── README.md
```

| Module | Responsibility | Must not |
| --- | --- | --- |
| data | Fetch, time out, validate, normalize, cache | Know about tiles or combat |
| mapgen | Days → validated tile grid | Fetch or render |
| engine | Movement, encounters, combat, progression | Fetch, generate, or touch the DOM |
| render | Draw state; send input as actions | Own game rules |
| storage | Save and restore run state | Store tokens or raw API payloads |

## Core data model

```ts
type ContributionDay = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }; // date = YYYY-MM-DD

type ContributionSet = {
  username: string;
  source: "live" | "cache" | "demo";
  fetchedAt: string;        // ISO timestamp
  yearTotal: number;
  streak: number;           // computed over the full year
  days: ContributionDay[];  // the 91-day window, oldest first
};

type TileKind = "void" | "fog" | "wisp" | "chest" | "monster" | "boss" | "start" | "gate";

type Tile = {
  col: number; row: number;
  kind: TileKind;
  tier?: 1 | 2 | 3 | 4 | 5;
  day?: ContributionDay;    // absent only for void cells
  resolved: boolean;
};

type Hero = { name: string; level: number; xp: number; hp: number; maxHp: number; atk: number; auraTier: number; treasure: number };

type RunState = {
  version: 1;
  seed: number; rngState: number;
  source: ContributionSet;
  map: Tile[][];
  hero: Hero;
  pos: { col: number; row: number };
  combat?: { col: number; row: number; monsterHp: number };
  stats: { steps: number; defeated: number; chests: number };
  status: "exploring" | "combat" | "won" | "lost";
};
```

The saved run includes the 91 normalized days (about 4 KB), which is what lets retry and reload work without a new fetch. Raw API payloads are never stored.

## Demo dataset specification

Generated once by `scripts/make-demo-data.ts`, reviewed by hand, frozen as `src/data/demo-data.json`, and never regenerated after Phase 0. Username "demo-necromancer". Contents:

- 91 days with roughly 35% level 0, 25% level 1, 20% level 2, 12% level 3, and 8% level 4.
- One visible empty week in the first third (the "graveyard" stretch that tells the habit story).
- A 15-day streak ending on the last day, giving aura tier 2.
- One clear best day about two weeks before the end, hosting the boss.
- An intended route of 15–25 steps with 6–10 fights, confirmed by the simulator.

## Using Kiro — the evidence plan

Kiro usage is a pass/fail gate and 20% of the score, so the evidence is produced during the build, not reconstructed at the end. `/.kiro` is committed on day one and never added to `.gitignore`.

| Kiro feature | Concrete use in ContribQuest | Evidence |
| --- | --- | --- |
| Kiro Web | Planning: this PRD revision and the data-source spike were done in a Kiro Web session on 16 Nov | Journal entry, screenshot |
| Kiro IDE | Spec authoring and implementation | Specs and commit history |
| Specs | 4 specs. Each requirement carries the FR ID from this PRD (for example FR-MAP-4) so the chain PRD → spec → task → code → test is traceable | `.kiro/specs/*` |
| Specs vs vibe coding | The spike and the sprite drawing tool are vibe-coded; the generator and engine are spec-driven. The write-up compares the two with one example each | Journal |
| Steering | `game-rules.md` and `art-style.md` load automatically through file-match inclusion when Kiro edits the matching folders | Steering files; one before/after example in the write-up |
| Agent hooks | (1) On save in `src/mapgen/**` or `src/engine/**`: run `vitest --run` for the related tests. (2) On save of `game-rules.md`: ask the agent to check that `balance.ts` and `assign.ts` still match the rules. (3) Manual hook "balance check": run the simulator and summarize win rates | `.kiro/hooks/*`; a screenshot of a hook catching a failure |
| Property-based testing | Properties listed below, generated from spec requirements | `tests/*.prop.test.ts`; one real bug PBT found, written up |
| Custom agent | "balance-tuner": runs the simulator, reads the targets in `game-rules.md`, proposes constant changes in `balance.ts` only | Agent config in `.kiro`; journal entry |
| MCP and powers | The Playwright power plays the hosted `?demo` run as a smoke test and captures the README and Devpost screenshots. The GitHub CLI power opens PRs | Screenshots folder; PR history |
| Kiro Crew | Not used. The write-up says so | — |

**Build journal.** `docs/kiro-journal.md` gets 3–5 lines per working day: what Kiro did, what went wrong, a screenshot. The blog post and the write-up are assembled from it.

## Testing and quality strategy

**Property-based tests (fast-check), all in CI:**

| ID | Property | Requirement |
| --- | --- | --- |
| P1 | Generating twice from the same input gives deeply equal maps | FR-MAP-3 |
| P2 | Every input day appears in exactly one tile, in calendar order | FR-MAP-2 |
| P3 | Start, boss, and Gate exist, and BFS finds a route start → boss → Gate | FR-MAP-4 |
| P4 | The boss sits on the highest-count day (latest on ties), never on the start | Mapping rules |
| P5 | Every generated map has at least 6 fight tiles besides the boss | Shortfall rule |
| P6 | Starting ATK and max HP never decrease as the streak grows, and stop growing at tier 4 | Story 4 |
| P7 | Monster HP and damage never decrease as the tier rises | FR-COM-2 |
| P8 | `restore(save(state))` equals `state` | FR-SAV-1 |
| P9 | Live fixtures and demo data both pass the schema; random malformed payloads are rejected, never thrown past the boundary | FR-DEM-3, reliability |
| P10 | Shards needed never exceed the number of level-3/4 monsters, so the ward can always be broken | FR-MOV-7 |
| P11 | Every profile gets exactly one trait, and its rows are valid weekday rows | Weekday trait |
| P12 | For any press time, the grade is Perfect inside the Perfect window, Good inside the Good window, and Miss outside it; windows never shrink as the aura tier grows or with Calm mode on | FR-COM-5 |
| P13 | For any fight state, damage taken is ordered Perfect (0) ≤ Good ≤ Miss, and damage dealt is ordered Miss ≤ Good ≤ Perfect | FR-COM-5 |

**Fixture profiles:** demo, all-empty, single active day, very dense, best day on the first day, best day on the last day, a last day with 0 contributions, and the last date on a Saturday and on a Sunday (column-count edge cases).

**Other checks:** fetcher unit tests with mocked 200, 404, 429, 500, timeout, and malformed JSON; the balance simulator on every fixture; one manual full run per fixture; a Playwright smoke test against the hosted URL.

**Pre-submission check:** open the hosted app in a fresh private window on a laptop and on a phone, play the demo to victory and to game over, and play one live username.

## MVP acceptance criteria

- A player can open the hosted app, enter a username or use demo mode, and finish a run.
- Streak and totals visibly change hero statistics on the summary screen.
- The full game works offline in demo mode.
- Every FR in this document is checked against the hosted app, and P1–P9 pass in CI.
- The repo is public, MIT-licensed with the license shown in the About panel, contains `/.kiro`, and its README explains running, playing, the mapping rules, the data source, and its limits.
- The YouTube video is under 3 minutes and shows username input, the map, a fight, the boss, and the results screen.

## Timeline (WIB)

Today is Mon 16 Nov 2026. The data spike is already done, which returns about one day to the later phases.

| Phase | Dates | Focus | Exit criteria |
| --- | --- | --- | --- |
| 0 — Setup | Tue 17 – Wed 18 Nov | **Submit the credit form on day 1.** Create the Devpost draft. Repo, MIT license, Vite + TS scaffold, steering files, 4 specs written and reviewed, hooks, frozen demo data, decision log | Public repo with `/.kiro`; specs approved; `?demo` loads data |
| 1 — Map first | Thu 19 – Sun 22 Nov | Data module, map generator with P1–P5, renderer, movement, HUD, GitHub Pages deploy | An explorable demo map **live on the hosted URL** |
| 2 — Real data | Mon 23 – Tue 24 Nov | Live fetch, errors, cache, `?u=`, hero summary | Your own map loads on the hosted URL |
| 3 — Complete game | Wed 25 – Sat 28 Nov | Combat, progression, chests, wisps, boss, Gate, results, game over, persistence, simulator, P6–P9 | A full run wins and loses correctly on every fixture |
| 4 — Polish | Sun 29 Nov – Tue 1 Dec | Theme art, intro animation, D-pad, accessibility pass, README, screenshots via Playwright, comprehension test with 2–3 people | **Feature freeze at the end of Tue 1 Dec** |
| 5 — Submission | Wed 2 – Thu 3 Dec | Wed: record and edit the video, upload to YouTube, publish the blog post. Thu: write-up, social post, full checklist, submit by 21:00 | Submitted on Devpost |
| Buffer | Fri 4 Dec – Sat 5 Dec 05:00 | Emergency fixes only | — |
| After | 5 Dec – 30 Jan 2027 | Tag `v1.0-submission`. No pushes to the deployed branch during judging | App stays live |

If a phase overruns, cut from the MoSCoW list first, then from polish. Never cut demo mode, the boss, the results screen, or Phase 5.

## Kiroween submission checklist

- [ ] Registered for Kiroween 2026 on Devpost; draft submission saved early and often.
- [ ] Category: Frankenstein. Bonus prizes selected in the form (blog, social, student if eligible).
- [ ] Public **GitHub** repository (GitLab and Bitbucket are not accepted) containing all source, assets, and instructions needed to run the app.
- [ ] `LICENSE` (MIT) at the root, visible in the repository About panel.
- [ ] `/.kiro` at the root with real specs, hooks, and steering; not listed in `.gitignore`.
- [ ] Hosted app URL works in a fresh private window. No login needed, so no judge credentials required.
- [ ] Built from scratch in the submission period; libraries and CC0 asset packs declared.
- [ ] Demo video under 3 minutes, public on YouTube, showing the app running on the build machine; no third-party trademarks or copyrighted music.
- [ ] Text description of features.
- [ ] Kiro usage write-up answering the official prompts (see the outline below).
- [ ] All materials in English.
- [ ] Blog post URL and social post URL included.
- [ ] Credit form submitted (target 17 Nov, hard limit 2 Dec 03:00 WIB) and any code redeemed by 4 Dec PT.
- [ ] Submitted by Thu 3 Dec 21:00 WIB; final deadline Sat 5 Dec 05:00 WIB.

## Demo video plan (target 2:55)

Recorded on Wed 2 Dec with the author's own username on the same day, plus a backup take in demo mode. English voice-over or captions. Music is self-made or none.

| Time | Content | Criterion served |
| --- | --- | --- |
| 0:00–0:15 | The problem: "I check my contribution graph, see a number, and close the tab." | Potential Impact |
| 0:15–0:35 | Type a username. The flat calendar rises into the haunted map. "Every day of the last 13 weeks is now a tile." | Innovation, Presentation |
| 0:35–0:55 | Hero summary: total → starting level, 15-day streak → aura tier 2 (+2 ATK, +10 HP) | Story 4 |
| 0:55–1:30 | Explore: a wisp, a chest, a Bug Imp "risen from Wed 9 Sep — 6 contributions". Land a CRITICAL! strike | Story 2 |
| 1:30–2:05 | The boss: "The Phantom of your best day — 31 contributions." Two-strike combo, one PERFECT DODGE! with counter, win, the Gate opens | Design, Presentation |
| 2:05–2:25 | Results next to the GitHub numbers; "Today's tile is still dark…" | Potential Impact |
| 2:25–2:55 | How Kiro built it: a spec requirement → its property test → the hook catching a failure → steering keeping the rules consistent; `/.kiro` in the repo | Technological Implementation |

Exploration footage is cut first if the rehearsal overruns. The problem statement, one fight, the boss, results, and the Kiro segment are never cut.

## Write-up outline

1. What ContribQuest is, in 2–3 sentences, and the category statement.
2. The problem, and who it is for.
3. How it works: the mapping table, the layout, the boss and aura rules.
4. The Frankenstein stitching: calendar data, game engine, retro rendering.
5. Prior art and what is different.
6. How Kiro was used, answering each official prompt: which Kiro clients (Web for planning, IDE for building; Crew not used), the custom agent, each hook and what it automated, how specs were structured and how they compared with vibe coding, the steering strategy that worked best, MCP and powers (Playwright), and which requirements got property tests and the bug they found.
7. The data source, stated honestly with its limits, and the demo-mode fallback.
8. What was left out and what comes next.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| The community API goes down, changes, or rate-limits, including during judging (16 Dec – 29 Jan) | Live import fails for judges | 1-hour cache, a demo button on every error, demo mode named in the README for judges, and the ncdai Worker as a ready fallback |
| Kiro usage judged insufficient | Disqualification at stage 1 | The evidence plan, the daily journal, and `/.kiro` committed from day 1 |
| Innovation scored low because of prior art | Lower score | Name the prior art; lead the video with the per-day labels and best-day boss |
| Scope grows toward a full RPG | MVP unfinished | MoSCoW list; feature freeze Tue 1 Dec |
| Balance is trivial or impossible for some profiles | The demo feels broken | Constants in one file, simulator targets, fixture profiles |
| Video contains trademarks or copyrighted music | Rule violation | No GitHub logos or Octocat; self-made audio or none |
| Repo or deployment changes after the deadline | Questions about eligibility, or a broken app during judging | Tag `v1.0-submission`; freeze the deployed branch |
| Credit code arrives late or not at all | Lost build time | Submit the form on 17 Nov; the plan does not depend on credits |
| Video and write-up left to the last night | Rushed or late submission | Phase 5 is two full days, plus a buffer to Sat 05:00 |

## Open questions (Phase 0)

- **Student status.** The build is solo. If the author is a student, enter Best Student Project and prepare student emails and LinkedIn profiles.
- **Art source.** Self-drawn sprites or a CC0 pack? Decide by Wed 18 Nov.

## Decision log

| Date | Decision | Options considered | Reason |
| --- | --- | --- | --- |
| 16 Nov 2026 | Primary data source: grubersjoe community API; fallbacks: local cache, demo mode, self-hosted Worker | Official GraphQL (needs a token), community API, profile proxy, demo only | Verified daily counts and levels, CORS `*`, no token; fits the no-backend MVP |
| 16 Nov 2026 | Window: 91 days in the GitHub calendar layout | 30, 90, 91, or 365 days | 13 full weeks match the graph shape and fit a 2–3 minute run |
| 16 Nov 2026 | Intensity: use GitHub's own `level` field | Custom quartiles, fixed thresholds | Already relative per user; no extra logic to test |
| 16 Nov 2026 | Stack: TypeScript, Vite, Canvas 2D, Zod, Vitest, fast-check, GitHub Pages, MIT | Plain JS; Phaser; Vercel | Typed boundary, small code, PBT support, hosting next to the repo |
| 16 Nov 2026 | Touch D-pad in the MVP | MVP or post-MVP | About one hour of work; judges may use a phone |
| 16 Nov 2026 | Streak grants ATK and HP, not levels; chests and level-ups heal; no inventory | Streak levels; item system | Simpler to explain, test, and finish |
| 16 Nov 2026 | Solo build | Solo, or up to three | Decided by the author |
| — | Art source | Self-drawn or CC0 pack | Phase 0 |

## Sources

- Kiroween 2026 official page: https://kiroween.devpost.com/ (the page blocked automated access on 16 Nov 2026; dates, requirements, prizes, and judging criteria were taken from AWS's Japanese summary of the official page and rules as of 31 Oct 2026: https://aws.amazon.com/jp/blogs/news/kiroween-2026/). Confirm the details on Devpost before submitting.
- Contribution data API: https://github.com/grubersjoe/github-contributions-api
- Self-hostable fallback: https://github.com/ncdai/github-contributions-api
- Prior art: https://github.com/abozanona/pacman-contribution-graph, https://github.com/zhouzi/contrib-awakens, https://dev.to/fcsouza/show-dev-i-turned-your-github-commit-history-into-an-idle-rpg-3j41
