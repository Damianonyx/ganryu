# Arena combat rebuild plan

## Confirmed direction

The game is being redesigned across its characters, controls, abilities, strongest fighter, arenas, identity, and backend. The planned roster has 14 fighters: four selectable protagonists (two male and two female samurai) and ten antagonists — nine followers and their leader. Players choose a protagonist for a campaign spanning nine preliminary encounters and a final confrontation at level 10. This replaces the earlier 26-fighter, 21-level plan.

The story and cast are now defined:
- [STORYLINE.md](STORYLINE.md) covers the village attack, the revenge premise, and the campaign chapters.
- [CHARACTERS.md](CHARACTERS.md) covers the 14 fighters and their reference sheets.

Already in the game:
- the roster, with working names
- the ten-battle campaign
- the warrior-select screen
- the opening film as the loading screen
- touch controls and combat sound

The backend milestones below have not started.

The setting remains dark samurai/fantasy. The strongest fighter will be strongest in the lore and have a balanced playable PvP version. These are confirmed design decisions.

The prototype's original 18-fighter roster and twelve-level campaign have been replaced. Old saves still load: their wins and losses are kept, unknown fighters map to Kairo, and levels clamp to ten. The fighters' 3D bodies and in-match powers are still prototype systems restyled per character, not the final kits.

## Design decisions

| Decision | Working recommendation | Status |
| --- | --- | --- |
| Game name | Select a distinctive name after confirming the setting and signature mechanic | Open; GANRYŪ remains the working title |
| Setting | Dark samurai/fantasy | Confirmed |
| Strongest fighter | Nethrak, The Eternal Nightmare; strongest in the lore, with a balanced version if he becomes playable in PvP | Identity confirmed; kit is a proposal |
| Target roster size | 14 fighters: four protagonists, nine enemy followers, and their leader | Confirmed target; implement and test in batches |
| Campaign structure | Nine preliminary encounters, then the antagonist at level 10 | Confirmed and implemented (ten battles in four chapters) |
| Opening cinematic | Childhood village attack, the leader killing the parents, survival, and a vow to train for revenge | Implemented as the loading-screen film (painted, with temporary voices); staging details remain draft |
| Four protagonist origins | Kairo is the village survivor; Hakuren, Shion, and Akari are allies he meets along the way | Confirmed; the allies' motives are still open |
| Warrior select | Only the four protagonists can be chosen to enter the arena | Confirmed and implemented |
| Match size | Prove 1v1 first; specify co-op/team sizes before implementing them | Proposed implementation order |
| Time folding | Retain only if its shared multiplayer rules are clear and enjoyable | Under review with the other abilities |
| Target devices | Test keyboard/mouse and touch separately; decide controller support explicitly | Final input scope open |
| Hosting and launch capacity | Choose from measured session cost, regions, latency, and expected concurrency | No provider or capacity commitment |

Working recommendations support planning. They must not be presented as final creative decisions or shipped features.

## Fighter design

Create one record for each proposed fighter before implementing its abilities:

- Stable internal ID, display name, identity, and place in the world.
- Silhouette, visual style, weapon, role, intended player experience, and a coherent 3D animation set.
- Movement, attack reach, health, defense, and resource model.
- Basic attack, defensive action, mobility action, and signature abilities.
- Clear strengths, weaknesses, counters, and difficulty of mastery.
- How the fighter behaves in each supported match mode.
- Asset sources and usage rights.

For every ability, specify activation conditions, input behavior, startup, active duration, recovery, range, target rules, resource cost, cooldown, interrupt behavior, and counterplay. Define how it interacts with invulnerability, simultaneous hits, boundaries, and other abilities.

Keep stable IDs separate from display names so renaming a fighter does not invalidate saves or match history. Version balance data and record the version used by each match. Display-name changes should not require rewriting historical results.

### Favorite fighters and the strongest fighter

Players should be able to choose a favorite fighter from the available roster. Plan for saving that preference and tracking character familiarity or mastery separately from competitive power.

Recommended policy: mastery unlocks expression, cosmetics, or recognition rather than an automatic statistical advantage in PvP. This recommendation can be revisited with an explicit progression design.

The strongest story character establishes the world's power scale. Its playable PvP version must have a balanced kit and meaningful counters. A separate boss version may have exceptional rules in PvE. Do not assign the final strongest fighter's name or abilities before those creative decisions are made.

## Controls and combat readability

Define actions independently from physical keys and touch buttons. Keyboard, controller if selected, and touch input should map to the same validated action contract.

The control design must specify:

- Movement and camera behavior, aiming or target selection, and directional attacks.
- Tap versus hold behavior, input buffering, and action cancellation.
- Basic attack, defense/parry, movement ability, and signature abilities.
- Remapping and conflicts with menus or focused text fields.
- Touch target sizes, safe areas, visibility, and feedback during cooldowns.
- How input behaves on blur, focus loss, disconnection, and reconnect.

Separate decorative typography from information that must be read during a fight. Make health, resources, ability readiness, and incoming threats legible over every arena background.

## Arena design

Different matches should support different arenas. An arena is more than a color preset: specify its geometry and gameplay rules as well as its atmosphere.

Each arena definition needs:

- Stable ID and version, visual identity, lighting, and performance budget.
- Supported modes, player count, bounds, spawn positions, and spawn protection.
- Collision geometry, elevation rules, sight lines, and camera constraints.
- Any hazards, their timing, their damage rules, and how players read them.
- Selection rules such as rotation, voting, or random selection.
- Fairness checks for spawn advantage and fighter-specific exploits.

The first reference arena should be easy to read and have simple collision geometry. Add hazards and more complex layouts only after basic combat works across the network. The server chooses and publishes the arena ID, version, and any gameplay seed; clients cannot choose different collision or hazard rules.

## Backend direction

Keep React and Three.js for presentation while extracting a simulation that runs without browser globals, rendering objects, audio, or UI stores. Preserve the fixed simulation step. Separate cosmetic randomness from gameplay randomness, and use an explicit seeded source when reproducibility is needed.

Recommended architecture:

| Component | Responsibility |
| --- | --- |
| Browser client | Menus, input capture, rendering, sound, prediction, interpolation, and correction |
| Account API | Authentication, profiles, fighter preferences, and match history |
| Match service | Authenticated room admission, match lifecycle, simulation, hit validation, cooldowns, health, and results |
| PostgreSQL | Durable accounts, profiles, preferences, match records, and validated progression |
| Optional coordination store | Multi-instance presence or matchmaking when scaling requires it |

A TypeScript match service, potentially using Colyseus, is the initial recommendation. Confirm the library and deployment requirements before adding it. An authoritative room server still needs explicit tick budgets, disconnect policy, deployment draining, and recovery behavior.

The server accepts actions, never a client's declared health, damage, winner, or reward. Authenticate admission using verified sessions or short-lived scoped tickets. Validate match membership, protocol version, input sequence, payload size, and rate. Stable character and arena versions are part of the match contract.

Use explicit room states: waiting, ready, countdown, active, reconnecting, completed, and closed. Define who can trigger transitions, reconnect deadlines, disconnect/forfeit behavior, and simultaneous-knockout outcomes. Match start is coordinated by the server.

Store results transactionally using a unique match identifier. A retried submission must not award progression twice. Only the trusted match service can finalize a result. Browser-local campaign saves must not become proof of a competitive win.

Keep real-time simulation state in the match process; do not write every frame to PostgreSQL. A client reconnect and a crashed server are different recovery cases. Initially, a match process crash may invalidate the match without rewards; document that policy until durable match recovery exists.

Production must reject missing database/auth configuration rather than silently creating an in-memory account store. Separate development, preview, and production data. Plan explicit migrations, backups and a restore check, structured logs, match IDs, error reporting, and latency/tick-duration metrics.

Replace hosting-specific authentication or preview integrations in isolated changes with session and save compatibility checks. Internal identifiers and service URLs are not authorship claims; blindly renaming them can break login or deployment.

## Delivery milestones

### 1. Reproducible foundation

- Document configuration with safe examples and required versus optional values.
- Fix the current lint errors and make tests independent of absent template files.
- Isolate test fixtures from the actual game's branding and production configuration.
- Make the normal test command run all relevant suites even when one suite fails.
- Add CI for clean installation, types, lint, tests, and build without production credentials.
- Separate deployment migrations from ordinary compilation before production use.

Exit condition: a clean checkout can run the documented commands successfully, and CI reports actual failures without requiring the original authoring environment.

### 2. Combat contract and reference content

- Write the action protocol, simulation state, fighter schema, and arena schema.
- Define two reference fighters and one reference arena without committing the full roster.
- Extract shared simulation rules and test movement, ranges, cooldowns, damage, and match end conditions.
- Define server/client behavior for time effects before enabling them in PvP.

Exit condition: the same simulation rules run without a browser, and representative input sequences produce testable outcomes.

### 3. A complete online duel

- Connect two independent authenticated clients to a real match service.
- Coordinate fighter/arena selection, ready state, countdown, input, and shared state.
- Preserve the connection when moving from lobby to gameplay.
- Handle disconnect/reconnect, match completion, validated persistence, and rematch.

Exit condition: two clients observe the same duel and outcome, reconnect within the agreed window, and receive one durable result even when result handling is retried.

### 4. Quality under real network conditions

- Test representative latency, jitter, loss, reordered actions, duplicate actions, and temporary outages.
- Test clients on different networks and target devices, not only two local tabs.
- Measure tick duration, frame time, bandwidth, corrections, and match completion rate.
- Reject forged identities, impossible actions, unauthorized room operations, and client-declared rewards.
- Establish an initial concurrency target and load-test against it before making capacity claims.

Exit condition: agreed gameplay and reliability targets are measured and documented.

### 5. Roster, arenas, and additional modes

- Expand fighters in batches using shared schemas, reviewed art, and matchup testing.
- Implement favorite-character persistence and the selected progression model.
- Add arenas with mode-specific fairness and performance checks.
- Add co-op or team modes after their player count, rules, and budgets are specified.
- Add competitive ranking after result integrity and balance are established.

## Collaboration

Use one task owner per branch or worktree. Codex and Claude Code share `AGENTS.md` and the same contracts. A reasonable split is Codex for the player-facing game/UI and Claude Code for backend foundations, with cross-review of integration points.

Agree on protocol and data-schema changes before either implementation depends on them. Each change should name its acceptance criteria, tests, and remaining gaps. Update this plan as decisions become final; update the README only when a feature's actual status changes.
