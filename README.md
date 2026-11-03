# GANRYŪ

巌流 — Time is the blade.

GANRYŪ is a 4D ronin fighting game. Pick a fighter, climb twelve levels, and fold time when steel is not enough. The last pair cannot be cut unless you fold the Fourth.

Live: [ganryu.grok.me](https://ganryu.grok.me)

## Play

- **Campaign** — twelve levels. Enemies hit harder, move faster, and fight smarter as the folds rise. Levels 11 and 12 are two-on-one.
- **Duel** — a private fight against another player.
- **Co-op** — two players in the same room.
- **Watch the ring** — a live simulation of the arena.
- **Sign in** — email and password. Fighter, fold, wins, and losses are saved to the account and restored on the next login.

Landscape is the intended layout. A corner dock (stick, slash, parry, leap, power, fold) covers touch. Keyboard works too.

| Action | Keys |
| --- | --- |
| Move | W A S D or arrows |
| Slash | J or Space |
| Parry | L or Shift |
| Leap | K or C |
| Power | Q or E |
| Fold | F or R |

**Fold** is the fourth dimension: a brief cut through time. On the last fold it is the only way through.

## Roster

Eighteen fighters are playable. Each has its own weapon, pace, and power — mist step, raven storm, ember trail, iron stillness, blood cross, night bind, twin arrows, horn charge, spirit coins, dragon coil, water step, blood seal, iai, howl, gore, magma, reap, crush.

Two are not selectable. **Thorn Sovereign** and **Spiked Abyss** are the unbeatable bosses of level 12, **The Uncut Pair**. You fight both at once.

| Fold | Level | Foes |
| --- | --- | --- |
| 1 | First Fang | Werewolf |
| 2 | Fog Twin | Kage |
| 3 | Horned Grove | Chimera |
| 4 | Cinder Path | Hellwolf |
| 5 | The Field | Field Oni |
| 6 | Ember Court | Enma |
| 7 | Iron Horn | Kabuto |
| 8 | Closing Hand | Titan Claw |
| 9 | Dragon Vow | Ryu |
| 10 | Crimson Still | Akatsuki |
| 11 | Twin Blades | Yoru and Akai |
| 12 | The Uncut Pair | Thorn Sovereign and Spiked Abyss |

## Stack

- React 19, TanStack Start, Tailwind CSS v4
- Three.js arena, procedural fighters, Zustand
- Better Auth (email and password)
- Postgres, with PGLite when no database URL is set
- WebRTC peer rooms for duel and co-op

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:8080`.

```bash
npm run typecheck
npm test
npm run build
```

Set `DATABASE_URL` for Postgres. Without it, saves use the local PGLite fallback.
