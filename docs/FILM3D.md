# The 3D opening film

A 3D version of the opening film, staged in code with the game's own fighters and rendered offline. It follows the screenplay in [`src/cinematic/script.ts`](../src/cinematic/script.ts) shot for shot: each shot's length and fades come from there. The film's sound mix, voices, and subtitles therefore line up with it unchanged.

It is the default intro: `public/cinematic/opening.mp4` is this film, rendered at 1280×720 with its sound mix. The painted film plays instead for reduced motion, if the video cannot load, or with `?film=painted`.

## Where things are

| Path | What it holds |
| --- | --- |
| `src/film3d/lab.ts` | The stage: renderer, post-processing (bloom, optional ambient occlusion and depth of field, grade, fades), fire, and actors driven along scripted paths |
| `src/film3d/direct.ts` | Directing helpers: keyframes (`keys`), walks and routes, facing, camera moves with handheld drift and shake |
| `src/film3d/people.ts` | The people who exist only in the film: the boy, his father and mother, the villagers, and Kairo as a youth. Faces with brows and a mouth that can change; the practice sword, the household sword, and the charm |
| `src/film3d/sets.ts`, `village.ts`, `interior.ts`, `ruins.ts` | Skies, mountains, trees, houses, lanterns, the gate and bell tower, weather; the village; the house and its cellar; the burnt village |
| `src/film3d/hands.ts` | Close-up hands with jointed fingers, and the charm |
| `src/film3d/acts/act1.ts` … `act8.ts` | The shots, one file per act |
| `src/routes/film-lab.tsx` | `/film-lab`: mounts the stage for rendering (`window.__film.load(id)`, `step(dt)`) |
| `scripts/film3d/` | Render tools (see its README) |

Actors are the game's rigs. A `Direction` on the shared body (`src/game/rig-humanoid.ts`) lets a shot pose them beyond the game's moves. It covers relaxed arms that swing with the walk, kneeling through foot targets, whole-body pitch for falls, and two-bone arm IK so hands reach points in the world: a child's shoulders, the hatch lid, a sleeve. The game never sets a direction.

## Rendering

The sandbox renders on the CPU, at about 1.5–2.5 s a frame at 960×540 and several times that at 1080p. A draft of the whole film at 960×540, 30 fps is about 2,200 frames, roughly an hour and a half.

```bash
scripts/film3d/snap.sh 8081                                                      # serve a frozen copy of the code
PORT=8081 node scripts/film3d/capture.mjs act3 30 960 540 3a 3b 3c 3d             # frames
scripts/film3d/assemble-range.sh artifacts/film3d/act3 18 28 act-3                # with the film's sound and subtitles
PORT=8081 node scripts/film3d/capture.mjs stills 0 960 540 "4b@0.5,1.5"           # stills to check a shot
```

Ambient occlusion is off by default and on only for interiors and close-ups. Over deep outdoor views it streaked and darkened the sky.
