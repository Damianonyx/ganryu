# GANRYŪ — contest submission

**A dark samurai arena game built with AI, playable in the browser on phone and desktop.**

## The story

A mountain village burns in a single night. Armored samurai and monsters, led by **Nethrak, The Eternal Nightmare**, overrun it. Hidden beneath the floor of his home, a boy watches through a gap in the boards as Nethrak kills his parents. He is the village's only survivor.

He spends years training in his father's stance. As **Kairo, The Last Ember**, he hunts the faction down with three allies he meets along the way: Hakuren, Shion, and Akari. Nine followers hold the road to their leader.

*Nine stand between you and revenge.*

## What to try

1. **The opening film.** About 76 seconds of painted animation that plays while the game loads, with voices, sound effects, music, and subtitles. It tells the story of the night of the attack: Kurogane leads the samurai through the gate, the twins Sei and Rei move between the trees, Vargash breaks the gate, and Nethrak enters with Kharzul and Kurogane behind him. Replay it any time from the menu with **Replay intro**.
2. **Choose your warrior.** Pick one of the four protagonists, each with their own stats, story, and skills. The skill marked **Art** is the one each warrior uses in battle now.
3. **The campaign.** Ten battles in four chapters against the nine followers, ending with Nethrak. Each opponent teaches a lesson: reading feints, spacing against reach, anti-air, patience.
4. **Duel vs AI.** A quick one-off fight against a random follower.

## How to play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | `WASD` | Left joystick |
| Slash | `J` | Slash button |
| Parry | `L` | Parry button |
| Leap | `K` | Leap button |
| Art (special power) | `Q` | Art button (fills with the meter) |
| Fold (dodge) | `F` | Fold button |

In the film: `Esc` skips, `Space` pauses, `M` toggles sound, and `C` toggles subtitles. Tap once for sound on a first visit, because browsers block audio until you interact.

## How AI was used

| Part | Tool |
| --- | --- |
| Character designs (14 reference sheets) | AI-generated art, directed by the creator |
| All game code: engine, combat, AI opponents, menus, warrior select, mobile controls, loading system | Claude Code |
| Opening film: screenplay, procedural painted animation, timing, subtitles | Claude Code |
| Voices (narrator, father, mother, child, Nethrak) | Piper text-to-speech, scripted and timed by Claude Code |
| Music and sound effects (sword clashes, parries, footsteps, taiko, bell, fire) | Synthesized in code by Claude Code (Web Audio and Python) |
| Story, characters, names, and creative direction | The creator, developed in conversation with Claude |

## Built with

React 19, TanStack Start, Three.js, TypeScript, Zustand, and Tailwind CSS, deployed on Vercel. Blender (Python scripts) was used for an optional 3D version of the film and for generating the sound files.

## Honest notes

- The fighters are animated 3D bodies styled after their sheets, not final character models.
- Each warrior has one special Art in battle today. The other skills on the select screen are the planned kits.
- Online play is not finished, so only local play against the AI is offered.
- The voices are text-to-speech placeholders.
