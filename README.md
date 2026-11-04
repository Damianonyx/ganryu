# GANRYŪ

A dark samurai/fantasy arena combat game in active redevelopment.

**GANRYŪ is the working title.** The final game name, fighter identities, abilities, controls, and arena designs are being reconsidered together.

The goal is a story-driven arena combat game with multiplayer, where players can choose a favorite fighter, master a distinct combat style, and fight across varied arenas. The planned campaign follows a village survivor's quest to avenge his parents: defeat nine members of the attacking faction, then confront their leader at level 10.

The planned roster contains **14 fighters: four selectable protagonists (two male and two female samurai) and ten antagonists — nine followers and their leader**. Players take their chosen protagonist through the campaign. The rebuild also includes clearer controls, redesigned abilities, improved 3D animation, and a backend that owns match rules and results.

## Current status

This repository contains an early browser prototype. The planned redesign has not been implemented yet.

| Area | Available in the prototype | Rebuild direction |
| --- | --- | --- |
| Fighters | 18 selectable fighters and two boss definitions | 14 redesigned fighters: four protagonists and ten enemy-faction characters, including their leader |
| Combat | Local combat against AI, keyboard/touch input, and a time-fold ability | Responsive controls, readable attacks, explicit ability rules, and balanced matchups |
| Arenas | One arena structure with visual variants | Distinct arenas with defined layouts, spawn rules, and supported match modes |
| Multiplayer | Room discovery and WebRTC signaling; entering a match currently starts local gameplay | Real shared matches, server validation, reconnect handling, and reliable results |
| Accounts | Sign-in and per-user save endpoints | Persistent profiles, favorite fighters, match history, and server-validated progression |

The existing campaign has twelve levels. The planned replacement has 10 levels and a childhood opening cinematic. A preview of that cinematic, with temporary art and sound, now plays before the title menu and loads the game behind it; see [the cinematic notes](docs/OPENING_CINEMATIC.md). Its story and character details are being developed in the [storyline draft](docs/STORYLINE.md). The current roster, controls, progression, and boss rules remain prototype content. Online duel and co-op gameplay are not ready for release.

## Rebuild priorities

1. Establish the game's identity, combat rules, fighter roles, and arena rules.
2. Make the project reproducible with documented configuration and reliable checks.
3. Build a complete online duel using two fighters and one arena.
4. Validate controls, match fairness, latency handling, reconnects, and saved results.
5. Expand the roster and arenas, then add further match modes.

The long-term roster should let players specialize in a favorite character. The dark samurai/fantasy setting is confirmed. The strongest fighter will be strongest in the lore, with a balanced playable version for PvP. That fighter's name, identity, and abilities remain to be designed.

- [Storyline and opening cinematic draft](docs/STORYLINE.md)
- [Opening cinematic preview and preloader](docs/OPENING_CINEMATIC.md)
- [Rebuild plan and design decisions](docs/REBUILD_PLAN.md)
- [Claude Code implementation brief — handoff on hold during story development](docs/CLAUDE_CODE_BRIEF.md)
- [Shared development instructions](AGENTS.md)

## Development

Use Node.js 24 LTS and npm. From the repository root:

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:8080`.

The current frontend uses React 19, TanStack Start, Three.js, Zustand, and Tailwind CSS. Authentication uses Better Auth. Database access uses PostgreSQL, with an in-memory PGlite fallback for local development.

### Database and configuration

Set `DATABASE_URL` to use PostgreSQL. Without it, database accounts, sessions, and saves use the in-memory fallback and reset when the server restarts. Browser-local progress is stored separately.

The current `npm run build` command also runs database migrations when `DATABASE_URL` is present. Use an isolated development or preview database for local validation. Separating migration execution from builds is part of the foundation work.

Independent production deployment also needs explicit authentication configuration and replacement of remaining hosting-specific integrations. A production-ready configuration guide is part of the rebuild; setting a database URL alone does not complete that work.

### Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

At the initial rebuild review, type checking and the production build passed. The script test suite had 17 failures and lint had two errors. The separate auth/data test suite passed. Several tests still assume files and defaults from the original development environment. Restoring a reliable test baseline is the first implementation task.

Combat rules, two-client gameplay, reconnects, and authoritative results need dedicated coverage before multiplayer release. A passing frontend build does not establish that online matches work.

## Working on the rebuild

Codex and Claude Code should use the same instructions in [AGENTS.md](AGENTS.md), the same documented message contracts, and small changes with observable acceptance criteria. Planned features must remain labeled as planned until verified end to end.
