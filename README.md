# GANRYŪ

A dark samurai/fantasy arena combat game for the browser, on desktop and mobile.

**GANRYŪ is the working title.** The final name is still undecided.

## The story

A mountain village burns in a single night. Armored samurai and monsters, led by **Nethrak, The Eternal Nightmare**, overrun it. Hidden beneath the floor of his home, a boy watches Nethrak kill his parents. He is the village's only survivor.

Years of training turn grief into purpose. As **Kairo, The Last Ember**, he hunts the faction down with three allies he meets along the way. Nine followers hold the road to their leader. The tenth battle is the reckoning.

*Nine stand between you and revenge.*

- [Storyline](docs/STORYLINE.md): confirmed events, the treatment, and the campaign chapters.
- [Character roster](docs/CHARACTERS.md): the 14 fighters with their reference sheets.

## The roster

| Protagonists (playable) | Antagonists (campaign order) |
| --- | --- |
| **Kairo**, The Last Ember: the village survivor | 1 Kurogane · 2 Sei · 3 Rei · 4 Mumyō · 5 Vargash |
| **Hakuren**, The Pale Exile | 6 Mokuren · 7 Gorvane · 8 Enjirō |
| **Shion**, The Veiled Rain | 9 **Kharzul**, The Hand of Thorns: second in command |
| **Akari**, The Prayer Blade | 10 **Nethrak**, The Eternal Nightmare: the leader |

Players choose one of the four protagonists and keep that warrior for the whole campaign. Names are approved working names.

## What is in the game now

| Area | Implemented | Still planned |
| --- | --- | --- |
| Opening cinematic | About 76 s painted film that plays while the game loads: voices, sound effects, music, subtitles, Skip/Continue, pause, Replay intro, reduced motion. Nethrak and five followers drawn from their sheets. | Recorded voice actors, a composed score, final art |
| Warrior select | Full-screen select for the four protagonists, showing each warrior's skills, stats, story, and campaign progress. Fits phones (portrait and landscape) and desktop. | Unlockables and mastery |
| Campaign | Ten battles in four chapters (The Outer Defenses, The Pursuit, The Inner Circle, The Reckoning), against local AI | Story scenes between chapters, distinct arena layouts |
| Fighters | 14 fighters as animated 3D bodies styled per character | Real character models, animation sets, and skill kits matched to `docs/CHARACTERS.md` |
| Controls | Keyboard; touch joystick with Art meter; four-button pad (Slash, Parry, Leap, Art) with cooldown rings; Fold | Remapping, controller support |
| Camera and sound | Side-on fight camera that fits any screen; sword swings, clashes, parries, hits, footsteps, sword draw | Per-arena ambience |
| Multiplayer | Room discovery and WebRTC signaling only. Entering a "duel" or "co-op" room still starts a local match. | Server-authoritative online duels with validated results ([plan](docs/REBUILD_PLAN.md)) |
| Accounts and saves | Sign-in, per-user server save, browser save; older prototype saves still load | Profiles, match history, server-validated progression |

The skill descriptions on the select screen are the design direction from `docs/CHARACTERS.md`. In-match powers still use the prototype ability set, one Art per fighter plus Fold, until the full kits are built.

## Running it

Use Node.js 22 or later and npm. From the repository root:

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:8080`.

| URL | What it does |
| --- | --- |
| `/` | Normal flow: the film on a first visit, the menu on later visits |
| `/?intro=1` | Always play the film (`&t=28` starts at 28 s, `&paused=1` starts paused) |
| `/?intro=0` | Skip straight to the menu |
| `/?intro=1&motion=reduced` | The reduced-motion version of the film |
| `/?intro=1&film=3d` | The optional Blender 3D version of the film |

Keyboard: `WASD` move · `J` slash · `L` parry · `K` leap · `Q` Art · `F` Fold. In the film: `Esc` skip, `Space` pause, `M` sound, `C` subtitles.

## Project map

| Path | Contents |
| --- | --- |
| `src/game/` | Engine (Three.js), fighters, roster, levels, input, combat audio |
| `src/components/` | Game stage, menus, warrior select, touch controls, opening cinematic overlay |
| `src/cinematic/` | Screenplay data (`script.ts`), painter, synthesized score, loading readiness, intro state |
| `public/fighters/` | Character art cut from the reference sheets (portraits and warrior-select art) |
| `public/cinematic/` | Film voice track, and the optional 3D film |
| `public/sfx/` | Combat sound effects |
| `blender/` | Blender scripts for the optional 3D film and its soundtrack ([README](blender/README.md)) |
| `docs/` | Storyline, characters, cinematic notes, rebuild plan |
| `server/`, `src/lib/` | Auth, database, saves, multiplayer signaling |

The opening film's shots, dialogue, subtitles, and timing are edited in `src/cinematic/script.ts`. See [docs/OPENING_CINEMATIC.md](docs/OPENING_CINEMATIC.md).

## Configuration

The frontend uses React 19, TanStack Start, Three.js, Zustand, and Tailwind CSS. Authentication uses Better Auth. Database access uses PostgreSQL, with an in-memory PGlite fallback for local development.

Set `DATABASE_URL` to use PostgreSQL. Without it, accounts, sessions, and server saves use the in-memory fallback and reset when the server restarts. Browser-local progress is stored separately.

`npm run build` also runs database migrations when `DATABASE_URL` is set. Use an isolated development or preview database for local validation.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run intro:verify   # with the dev server running: browser checks for the film and loading flow
```

Current results:

| Check | Result |
| --- | --- |
| Typecheck | Passes |
| Build | Passes |
| Opening-film browser checks (`intro:verify`) | 34/34 pass |
| TypeScript test suites, including the cinematic tests | 72/72 pass (run directly; see below) |
| Lint | 2 errors, both pre-existing |
| Script tests (`npm test`) | 17 pre-existing failures |

The 17 script-test failures come from tests that assume files from the original authoring environment. Because `npm test` chains its suites, those failures also stop the TypeScript suites from running, so run those directly:

```bash
node --experimental-strip-types --test src/lib/app-data/app-data.test.ts src/lib/app-data/readiness-schedule.test.ts src/lib/auth/gate-identity.test.ts src/lib/auth/sign-in-gate.test.ts src/cinematic/cinematic.test.ts
```

Restoring a reliable test baseline is part of the foundation work in the rebuild plan.

## Deployment

The repository is connected to Vercel:
- Each pushed branch gets a preview deployment.
- Merging into `main` deploys production.

Production with real accounts needs `DATABASE_URL` and explicit authentication configuration. Without them, the game runs on the in-memory fallback.

## Temporary content

- **Voices:** text-to-speech placeholders (Piper), to be replaced with recorded actors.
- **Film:** procedural art and sound.
- **3D fighters:** prototype bodies recolored per character, not final models.
- **Balance:** fighter stats and powers are first-pass values.

## Working on the project

Contributors (Codex, Claude Code, and others) follow [AGENTS.md](AGENTS.md). Planned features stay labeled as planned until they are verified end to end. The backend milestone in [docs/CLAUDE_CODE_BRIEF.md](docs/CLAUDE_CODE_BRIEF.md) is on hold while story and characters are developed.
