# Motion language

How GANRYŪ moves, in one page. Every animation, camera move, and effect in the game should be explainable from this file. When a new one is not, update this file first.

**The feel: heavy steel, quick hands.** The world has weight: blades connect with a pause, the camera settles, the fog rolls in. The controls never do: a press always does something, at once or as soon as the fighter is free.

## Principles

1. **Never drop a press.** A press made while the fighter is busy is remembered for a moment and fires as soon as it can. Defense must always be reachable: Parry can cut short the end of a slash.
2. **Weight lives on contact, not on the swing.** Hit-stop, shake, and blood bursts happen when a blade lands, scaled by what happened (parry, hit, kill). A miss is quiet.
3. **The camera never snaps.** Everything it follows is smoothed, including the point it looks at. Gameplay positions stay exact; only the view eases. There are no camera cuts during a fight.
4. **State changes blend.** Fold changes the field of view, fog, and exposure together over one blend time, never in a single frame.
5. **Teleports leave a trail.** Anything that moves a fighter instantly (Shadow Step, teleport Arts) leaves afterimages along the path, so the eye can follow where they went.
6. **The interface is quiet.** Menus fade and rise into place with `--ease-enter`. Only direct feedback (a pressed button, a ready Art) gets emphasis.

## Tokens

The interface uses CSS custom properties in `src/styles.css`. The engine and JavaScript use `src/game/motion.ts`. A test keeps the shared durations in step.

### Interface

| Token | Value | Use |
| --- | --- | --- |
| `--dur-fast` | 120 ms | Press feedback, hover, small state flips |
| `--dur-base` | 240 ms | Panels, overlays, controls fading in and out, progress |
| `--dur-slow` | 400 ms | Large entrances (the warrior on the select screen) |
| `--dur-scene` | 700 ms | Full-screen fades between the film, loader, and menu |
| `--ease-enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | Anything arriving: fast start, long soft landing |
| `--ease-exit` | `cubic-bezier(0.7, 0, 0.84, 0)` | Anything leaving: slow start, quick finish |
| `--ease-emphasis` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Slight overshoot, for direct feedback only |

In class names: `transition-opacity duration-(--dur-base) ease-(--ease-enter)`.

### Combat and camera (`motion.ts`)

| Token | Default | Meaning |
| --- | --- | --- |
| `input.buffer` | 0.15 s | How long a press is remembered while the fighter is busy |
| `input.slashCancel` | 0.26 s | After this point in a blade slash, Parry or the next Slash can cut the recovery short |
| `input.beastCancel` | 0.37 s | The same for beasts, after their second hit |
| `hitstop.parry` / `hit` / `kill` | 0.04 / 0.055 / 0.1 s | The freeze on contact |
| `shake.parry` / `hit` / `kill` | 0.25 / 0.38 / 0.7 | Trauma added; the shake is trauma² |
| `shake.decay` | 2.4 /s | How fast trauma fades |
| `shake.freq` | 18 Hz | Noise frequency of the shake |
| `camera.follow` | 5.5 /s | Camera body following its framing position |
| `camera.look` | 9 /s | The point the camera looks at, following the fighters |
| `camera.yaw` | 2.6 /s | Swinging around to stay side-on |
| `camera.zoom` | 2.2 /s | Pulling in or out to fit both fighters |
| `fold.blend` | 0.24 s | Field of view, fog, and exposure blending into or out of Fold |
| `dash.ghosts` | 4 | Afterimages along a Shadow Step or teleport |

Rates are exponential follow rates (`follow(rate, dt)` in `motion.ts`), so they behave the same at any frame rate.

## What never animates

- **The joystick knob while it is held.** It follows the finger exactly. It only eases back to center when released.
- **Gameplay positions.** Fighters' real positions, hit checks, and cooldowns never ease; only the camera and effects do.
- **Numbers.** Health values, the combo count, and battle numbers change instantly.
- **Subtitles.** They cut in and out with the dialogue.
- **Layout.** Width, height, top, and left are never transitioned. Progress bars scale on X instead.
- **`transition: all`.** Always name the property.

## Reduced motion

When the system asks for reduced motion (`prefers-reduced-motion: reduce`):

- Interface durations become 0.01 ms, so state changes are immediate.
- Camera shake is off.
- Fold keeps its fog and exposure change but not the field-of-view zoom.
- Hit-stop stays. It is a pause, not movement.
- Afterimages stay. They show where a fighter went without moving the view.
- The opening film uses its own reduced version (see [OPENING_CINEMATIC.md](OPENING_CINEMATIC.md)).

## Tuning by feel

Add `?tune=1` to the address (for example `https://ganryu.vercel.app/?tune=1`) to open a tuning panel during battles. It has sliders for the input buffer, hit-stop, shake, camera follow, look follow, and Fold blend. Changes apply immediately, so tune on a real phone, then tap **Copy values** and paste them into a message or into `MOTION_DEFAULTS`.

## Checks

`npm run lint:motion` (`scripts/motion-lint.mjs`) flags raw `cubic-bezier()` curves, raw millisecond durations, numbered `duration-*` classes, and `transition: all` in components and routes. Token definitions in `styles.css` and `motion.ts` are the only places raw values belong.

## Decision records

### Input buffer: 150 ms
- **Decision:** remember the last press for 0.15 s.
- **Why:** a phone tap counts for a single game step. Taps made during a slash, a stagger, or a landing were dropped, which feels like lag.
- **Rejected:** 250 ms. A Slash could fire after the player had already moved on.

### Parry and Slash can cut a slash's recovery short
- **Decision:** after the active part of a slash (0.26 s for blades, 0.37 s for beasts), a buffered Parry, or a Slash once its cooldown has passed, starts immediately.
- **Why:** defense must be reachable. A player who whiffs should be able to guard.
- **Rejected:** cancelling at any time. Startup and active frames stay committed, so a slash can still be punished.

### The camera's look point is smoothed separately
- **Decision:** the look point follows at 9/s; the camera body at 5.5/s.
- **Why:** Shadow Step moves Kairo 3.2 units in one step. The camera body eased, but its aim jumped, which read as a snap.
- **Rejected:** smoothing the fighter. Hit checks need the real position.

### Fold blends over 240 ms
- **Decision:** field of view, fog density, and exposure ease together over `fold.blend`.
- **Why:** they switched in one frame and read as a glitch (a white flash).

### Shake uses smooth noise at 18 Hz
- **Decision:** sum-of-sines noise instead of a new random offset every frame.
- **Why:** per-frame random offsets read as jitter at 60 fps, not as a blow.

### Touch Slash and Parry repeat while held
- **Decision:** holding a touch button keeps the action pressed, as holding a key does.
- **Why:** keyboard players could hold J; phone players had to keep tapping.
