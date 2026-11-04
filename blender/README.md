# Blender cinematic shots — test pass

Procedural Blender scenes for the opening cinematic. Every shot is generated from Python (no `.blend` files), so the scenes are reproducible, reviewable in diffs, and easy to retime or relight.

This is a **look-development test**, not final production. It shows lighting, atmosphere, and staging for selected screenplay beats. The characters are blockouts:

- **Thorn antagonist** (`characters.build_thorn_antagonist`) — built from the project owner's turnaround sheet: spined crown, beaked red helmet, layered thorn-shard armor and tattered robe, red veins, and four chains ending in glowing sickle talons. His exact role in the faction is not yet confirmed. The final in-game model should replace this procedural version.
- **Protagonist, parents, samurai, monsters** — generic placeholder silhouettes until their designs exist.

## Shots

| Shot | Screenplay beat | File |
| --- | --- | --- |
| `village` | 1a/1b — Evening over the village; father and child practise in the lane | `shots/shot_village.py` |
| `gate` | 2b — Armored samurai emerge beyond the gate; monsters in the smoke | `shots/shot_gate.py` |
| `fortress` | 8b — The fortress rises above the clouds; he draws his blade | `shots/shot_fortress.py` |
| `character` | Turnaround check of the thorn antagonist against the concept sheet | `shots/shot_character.py` |

## Setup

Blender's Python module requires Python 3.13:

```bash
python3.13 -m venv .venv-blender
.venv-blender/bin/pip install bpy==5.2.3
```

## Rendering

```bash
.venv-blender/bin/python blender/render.py gate --preview          # 960×540, 24 samples
.venv-blender/bin/python blender/render.py gate                    # 1920×1080, shot default samples
.venv-blender/bin/python blender/render.py gate --frames 1-72      # animated range → artifacts/blender/gate/0001.png …
.venv-blender/bin/python blender/render.py gate --res 1280x720 --samples 48
```

Output goes to `artifacts/blender/` (git-ignored).

The renderer is Cycles. EEVEE needs a GPU, and the cloud development container has none. On its 4 CPU cores, each 960×540 preview takes about 45–90 s and each 1080p still takes several minutes. A 1080p animated shot takes hours. A machine with a GPU renders much faster: set `scene.cycles.device = "GPU"` in `lib.reset_scene`.

## Integrating with the in-game cinematic

The web player (`src/components/opening-cinematic.tsx`) currently draws shots procedurally on a canvas. The planned next step is to encode rendered Blender shots as video segments and play them through the same controller. Subtitles, controls, audio, loading readiness, and intro state are all independent of how the image is produced.

## Known limitations

- Figures are static blockouts with no rigging, cloth, or animation beyond camera moves and simple poses.
- Flames are noise-masked emission sheets, not fluid simulation.
- Clouds and haze are noise-driven volumes, which dominate render time.
