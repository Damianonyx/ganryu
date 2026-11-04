# Claude Code brief

Use this brief for small implementation tasks. The full game redesign is a roadmap, not one unattended rewrite.

## First assignment: reproducible backend foundation

Copy this prompt into Claude Code from the repository root:

```text
Read AGENTS.md, README.md, and docs/REBUILD_PLAN.md first.

We are rebuilding this arena combat game: its name, roster, fighter abilities,
controls, strongest character, arenas, and multiplayer backend are being redesigned.
The current content is a prototype. Do not treat existing fighter names, ranks,
boss rules, or controls as finalized design decisions.

Two design rules are confirmed: retain the dark samurai/fantasy setting, and make
the strongest lore fighter balanced when played in PvP. Its identity and abilities
are still open. Preserve these rules throughout the rebuild.

Your first task is milestone 1: establish a reproducible foundation for a
server-authoritative multiplayer backend. Work on a dedicated branch.

1. Audit the current startup, authentication, database, migration, and test paths.
   Identify which hosting-specific integrations are used and which are unused.
   Preserve working login and save behavior while making changes incrementally.
2. Fix the current lint errors and tests that rely on missing authoring-environment
   files or read the real game's metadata as generic test fixtures. Use isolated
   fixtures and meaningful assertions; do not skip or weaken failing tests just
   to get a green result. Ensure all suites run and failures produce a nonzero exit.
3. Document the supported local configuration in .env.example and the README.
   Include database, authentication origin/secret, and explicit development-only
   fallbacks. Verify which values the current code actually consumes. Do not add
   real credentials or make claims that independent OAuth is already configured.
4. Make production startup fail clearly when required persistent database or
   authentication configuration is missing. Keep local development usable.
5. Separate database migrations from the ordinary build command. Document an
   explicit release migration step and keep local PGlite bootstrap functional.
6. Add CI that runs a clean install, type checking, lint, all tests, and a build
   against disposable configuration, without production credentials or migrations.
7. Record the proposed shared simulation/action contract and match-service
   boundaries in a short architecture document for the next milestone.

Do not implement the entire roster, pick the final game name, assign the strongest
fighter, redesign the interface, deploy infrastructure, or add ranking in this task.
Do not delete working authentication code solely because an internal identifier
contains a former hosting provider's name. Product copy should describe the game
without code-generation attribution. Preserve third-party license notices.

Acceptance criteria:
- A clean checkout runs the documented setup and all checks successfully.
- Tests do not require private or absent template files.
- Compilation does not mutate a configured production database.
- Missing production configuration fails clearly; documented local startup works.
- Login and per-user save behavior have appropriate regression coverage.
- The README accurately separates implemented behavior from planned multiplayer.

Open a draft PR explaining the concrete changes, verification results, and remaining
dependencies. Identify anything that needs an actual product decision. Do not merge
or deploy as part of this assignment.
```

## Next assignment: authoritative online duel

Start this after the foundation and the two reference fighters' combat rules are established:

```text
Read the shared instructions, rebuild plan, and agreed simulation/network contract.
Implement milestones 2 and 3 as small PRs with explicit acceptance criteria.

Extract browser-independent combat rules. Add a TypeScript match service using
the agreed transport/framework. Support one arena and two reference fighters.
Keep client rendering and shared simulation separate.

Use verified identity or scoped match tickets for room admission. The server owns
room membership, selection validation, ready/countdown transitions, movement limits,
hits, health, cooldowns, match completion, and rewards. Clients send sequenced actions,
never authoritative positions, damage, winners, or progression totals.

Keep the connection alive from lobby through results. Support the agreed reconnect
window, disconnect policy, and rematch flow. Persist match results and progression
transactionally and idempotently using a stable match ID. Record fighter/arena/rules
versions so historical results can be understood after balance changes.

Verify two independent clients observing the same fight and result. Test forged
identities, non-member actions, invalid ability use, duplicate inputs/results,
disconnect/reconnect, and representative latency/jitter/loss. Document server-crash
behavior and any cases not yet supported. Do not claim production capacity without
measurements. Update the README only for behavior that actually works end to end.

Coordinate frontend integration through the shared protocol. Open draft PRs with
the evidence; do not merge or deploy as part of the assignment.
```

## Review handoff

For each PR, provide the commit, changed boundaries, exact checks run, actual results, known limitations, and the next dependency. This lets either Codex or Claude Code review the implementation without relying on an earlier chat session.
