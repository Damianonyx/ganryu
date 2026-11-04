# Opening cinematic and preloader — preview build

A watchable preview of the proposed opening cinematic, integrated with the game's loading flow. The art, sound, and staging are **temporary**: procedural 2D silhouettes and synthesized audio that make the treatment reviewable before character designs, 3D animation, music, and voice exist.

The screenplay follows the current brief (≈75 seconds). The wooden charm, cellar, dialogue, and exact staging remain draft additions. The protagonist, his parents, and the antagonist are unnamed placeholders. The other four protagonists do not appear and their origins are left open.

## Viewing the preview

```bash
npm ci
npm run dev
```

| URL | Behavior |
| --- | --- |
| `http://127.0.0.1:8080/` | Normal flow: film on first visit, menu on later visits |
| `/?intro=1` | Always play the film |
| `/?intro=0` | Never play the film (menu only) |
| `/?intro=1&t=28` | Start at 28 seconds |
| `/?intro=1&paused=1` | Start paused (Space to play) |
| `/?intro=1&motion=reduced` | Force the reduced-motion version |
| `/?intro=1&clean=1` | Hide controls (stills for review) |

From the title menu, **Replay intro** plays it again.

Controls: **Skip/Continue**, **Sound**, **Subtitles (CC)**, and **Pause**. Keyboard: `Esc` skip, `Space`/`K` pause, `M` sound, `C` subtitles. The film pauses while the browser tab is hidden.

### Generated previews

With the dev server running:

```bash
npm run intro:contact   # artifacts/cinematic-preview/contact-sheet.html — one still per shot
npm run intro:video     # artifacts/cinematic-preview/*.webm — real-time recording (silent)
npm run intro:verify    # flow, audio, and layout checks; writes verify.json and screenshots
```

`artifacts/` is git-ignored. Set `PREVIEW_URL` to check another server.

## Loading and hand-off behavior

The game loads behind the film. Readiness is reported by the code doing the work; nothing completes on a timer.

| Task | Settled when | Gates the menu when the film is skipped by preference |
| --- | --- | --- |
| Arena renderer | The Three.js engine has rendered its first frames (shaders compiled, scene uploaded) | Yes |
| Player profile | The auth session check resolves (signed in or out) | Yes |
| Typefaces | `document.fonts.ready` | Yes |
| Fighter portraits | Every selectable fighter portrait has loaded and decoded | No — prefetch only |

A failed task still counts as settled, so a missing image cannot block the game.

| Situation | Result |
| --- | --- |
| Film ends or is skipped before loading completes | "Preparing the arena" loading state with real progress, then the menu |
| Loading completes during the film | Skip becomes **Continue**; the film keeps playing until the player continues or it ends |
| Returning player | Straight to the menu (briefly showing the loading state only if critical work is unfinished) |

While the film covers the stage, the game engine renders its initial frames and then idles instead of drawing hidden frames. It resumes when the menu appears. Leaving the film stops its animation loop, closes its audio context, removes its listeners, and releases its canvas.

### Saved state

The intro outcome is stored separately under `ganryu-intro-v1` as `{ outcome: "completed" | "skipped", version, at }`. The subtitle preference uses `ganryu-intro-subtitles`. Player saves (`ganryu-save-v1`, the legacy `yonji-save-v1`, and the server save) are not read or written. Sound uses the existing `ganryu-muted` preference and mute control, so the film and game share one setting.

Increase `INTRO_SCRIPT_VERSION` in `src/cinematic/script.ts` to show a substantially revised film again to players who already watched or skipped the previous version.

### Audio and browser restrictions

Browsers block audio until the player interacts with the page. On a first visit the film starts silently with a highlighted **Tap for sound** control; any tap or key press also enables sound, joining the ambient bed at the current scene. Replay Intro starts with sound because the menu click counts as interaction. Mute is respected throughout.

### Accessibility

- Subtitles are on by default, set on a dark panel with text shadow for legibility over fire and smoke, and include short sound captions such as `[warning bell]`.
- With `prefers-reduced-motion`, the film uses static cameras, no shake or screen flashes, steady firelight, fewer and slower particles, and a dissolve for the match cut. Timing and subtitles are unchanged.
- The overlay is a labelled modal dialog. Controls are at least 44 px tall and respect device safe areas.
- Wide screens fill the frame. Tall/portrait screens letterbox the image and place subtitles in the space below it.

## Editing the film

| What | Where |
| --- | --- |
| Shot timing, order, descriptions, fades | `SHOTS` in `src/cinematic/script.ts` |
| Dialogue, voice-over, sound captions | `CUES` in `src/cinematic/script.ts` |
| Speaker placeholder names | `SPEAKERS` in `src/cinematic/script.ts` |
| Tagline and title card | `END_CARD` in `src/cinematic/script.ts` |
| Sound hits | `SOUND_EVENTS` in `src/cinematic/script.ts` |
| Ambient beds per scene | `bedLevels` in `src/cinematic/score.ts` |
| How each shot is drawn | The routine for its `kind` in `src/cinematic/painter.ts` |
| Antagonist recognition details | `PROVISIONAL_ANTAGONIST_DESIGN` in `script.ts`; `antagonistFace`, `drawEmblem`, and the sword in `shotSwordFace` in `painter.ts` |

Shots must be contiguous; cues must not overlap on the same track. `npm test` (and `node --experimental-strip-types --test src/cinematic/cinematic.test.ts`) validates the script.

Each frame is a pure function of film time, so retimed shots can be checked immediately with `?t=` or the contact sheet.

## Files

- `src/cinematic/script.ts` — editable screenplay data
- `src/cinematic/timeline.ts` — shot/cue lookup and script validation
- `src/cinematic/painter.ts` — temporary procedural artwork
- `src/cinematic/score.ts` — temporary synthesized sound
- `src/cinematic/flow.ts` — film/loading/menu state transitions
- `src/cinematic/readiness.ts` — loading tasks and progress
- `src/cinematic/intro-state.ts` — intro outcome and subtitle preference
- `src/components/opening-cinematic.tsx` — overlay, controls, subtitles, loading state
- `src/components/game-stage.tsx`, `src/components/overlays.tsx` — integration and Replay Intro
- `scripts/cinematic-preview.mjs` — contact sheet, video, and browser verification

## Temporary assets and unfinished work

**Temporary**

- All imagery: procedural 2D canvas silhouettes, not final character designs, environments, or 3D animation.
- The child, adult protagonist, parents, antagonist, followers, and monsters are generic shapes. No in-game character models appear yet.
- The antagonist's half-mask, scar, broken horn, ring-and-blades emblem, and notched nodachi are placeholders that satisfy the "face, emblem, sword" requirement.
- The charm is a carved wooden disc on a red cord.
- All sound is synthesized: ambient beds, a bell, impacts, and a closing drum. There is no composed score.
- No voice recordings exist; dialogue and voice-over appear only as subtitles.
- `GANRYŪ` is the working title on the title card.

**Unfinished animation and staging**

- Figures use simple joint poses; there is no weight transfer, cloth, or facial animation.
- Hands (charm, sleeve, wrapped wrist, tying the charm) and faces are simplified.
- The father's catch-and-correct beat, the parents' deaths, and the antagonist's exit are staged in silhouette through the floor gap. They are readable, but they need proper direction and animation.
- The training montage shows age progression through four stages of silhouette size. It does not depict a consistent character.
- There is no camera depth or parallax beyond simple push-ins and pans.

**Assumptions**

- The film plays before the title menu. Protagonist selection remains on the existing select screen after it.
- The cinematic shows the canonical survivor's childhood regardless of which protagonist the player later chooses.
- "Continue"/"Skip" while watching records the intro as skipped; reaching the end records it as completed.
- Only critical tasks gate the menu for returning players, so they do not wait for portrait prefetching.

**Recommended next steps**

1. Decide the survivor/ensemble model and the antagonist's identity, then replace placeholder names and art.
2. Choose the production format: real-time 3D with the game's models, or a pre-rendered video with this preloader shell. The controller, loading logic, and subtitles are independent of the painter and can be reused for either.
3. Record voice-over and compose music; replace `score.ts` with audio files and keep subtitles timed to them.
4. Add a full storyboard review pass using the contact sheet before investing in final animation.
