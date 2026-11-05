# Shared development instructions

These instructions apply to Codex, Claude Code, and other contributors throughout this repository.

## Project direction

- Read `README.md`, `docs/REBUILD_PLAN.md`, and `docs/STORYLINE.md` before implementing a feature.
- The project is an arena combat prototype undergoing a full redesign.
- Confirmed creative rules: dark samurai/fantasy setting; the strongest lore fighter has a balanced playable PvP version.
- Confirmed targets: 14 fighters (four playable protagonists — two male and two female samurai — and ten antagonists: nine followers plus their leader). The leader is fought at campaign level 10 after nine preliminary encounters.
- The cast is in [docs/CHARACTERS.md](docs/CHARACTERS.md). Names are approved working names. Kairo is the village survivor; Hakuren, Shion, and Akari are allies he meets later. Nethrak is the leader and the strongest fighter in the lore.
- Still open: the final game name, the allies' motives, Nethrak's motive, final skill kits and balance, input design, and arena rules. Distinguish proposals from decisions.
- The opening film's events are confirmed. Its staging, dialogue, the charm, and the cellar are screenplay details, not fixed canon.
- Only the four protagonists are selectable in the campaign. Whether antagonists become playable in a versus mode is undecided.
- Preserve stable internal identifiers and save compatibility when display names change.
- Describe implemented behavior accurately. A room list is not a working online match.
- Product copy should focus on the game and avoid code-generation attribution. Preserve applicable third-party license notices.

## Architecture

- Keep rendering, audio, UI state, and device input separate from shared simulation rules.
- The multiplayer server must own combat decisions and competitive outcomes.
- Authenticate room membership and validate incoming actions; never trust client-declared rewards, damage, health, or winners.
- Persist match results idempotently and transactionally with a unique match identifier.
- Treat local PGlite and browser saves as development/prototype behavior, not production durability or evidence of a competitive result.
- Replace hosting-specific integrations incrementally. Renaming authentication identifiers without a migration can break sessions.
- Prefer the existing TypeScript/React/Three.js stack unless a documented requirement justifies a change.

## Working practices

- Use focused branches or worktrees and one implementation owner per task.
- Share action, snapshot, and data schemas before changing both sides of a network boundary.
- Avoid unrelated rewrites and do not invent final creative decisions to unblock routine engineering work.
- Use isolated test fixtures. Tests must not depend on missing private files or the current game's branding.
- Run checks appropriate to the change and report exact failures. Do not hide failing tests by skipping them or weakening their assertions.
- The current build invokes database migrations if `DATABASE_URL` is set. Use isolated databases until that coupling is removed.
- Keep configuration examples free of credentials. Use explicit development fallbacks and require production configuration.

## Commands

- Install: `npm ci`
- Start local development: `npm run dev`
- Type check: `npm run typecheck`
- Lint: `npm run lint`
- Tests: `npm test`
- Build: `npm run build`

The README records the initial failing test/lint baseline. Future tasks must distinguish those existing failures from any regressions they introduce.
