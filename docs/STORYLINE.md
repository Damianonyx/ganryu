# Storyline and opening cinematic — draft 2

This document records the campaign premise and the current narrative treatment. Confirmed decisions come from the project owner; proposed scenes, chapter details, and the protagonists' connection remain creative drafts. The redesigned campaign has not been implemented. A preview of the opening cinematic, using temporary art and the current ≈75-second screenplay, is described in [OPENING_CINEMATIC.md](OPENING_CINEMATIC.md).

Draft 2 replaces the earlier plan of 26 fighters and 21 campaign levels.

## Confirmed story and game structure

- The setting is dark samurai/fantasy.
- The central protagonist is a young boy living peacefully with his parents in a mountain village.
- One night, evil samurai and monsters attack the village. The assault is organized and overwhelming.
- The leader of the attacking faction personally kills the boy's parents and becomes the main antagonist. The boy witnesses their deaths but is too young and powerless to intervene.
- The boy survives as the village's sole survivor.
- Grief and rage drive his promise to train until he can surpass the antagonist and avenge his parents. His ambition is to become the strongest samurai.
- Years of practice follow. He struggles, fails, and gradually learns to control both his weapon and his anger.
- The planned roster contains **14 named fighters**:
  - four playable protagonists — two male and two female samurai;
  - ten antagonists — nine followers and the faction's leader. The leader is counted among the ten.
- Players choose one of the four protagonists and use that character throughout their campaign. Each protagonist must be able to complete the whole campaign through skill and mastery.
- The campaign has **ten levels**: nine encounters against the leader's followers, then the leader at level 10. Level 10 stays locked until all nine preceding enemies are defeated.
- The followers are real enemies, not friendly training instructors. The protagonist develops by fighting them.
- The strongest fighter in the lore has a balanced playable PvP version. Lore rank does not give an automatic competitive advantage.
- Fighters need distinct names, appearances, personalities, weapons, powers, skills, and improved 3D movement and animation.
- Different matches use different arenas.

## How the four protagonists fit together — proposed, not finalized

- One of the male protagonists is the village survivor.
- The other male protagonist and the two female protagonists are allies with their own reasons to oppose the antagonist.
- The four share the campaign's central mission; the player chooses which warrior to control in fights.
- Their shared story does not require all four fighters to appear in every encounter. The selected protagonist remains the player's fighter for the whole run.

Rules that hold under this proposal:

- The childhood cinematic follows the village survivor. It does not become the childhood of whichever hero is selected.
- Do not introduce additional survivors from the destroyed village.
- The other three protagonists' backgrounds, motivations, names, weapons, and abilities will be developed separately.

## Narrative treatment — proposed

The village falls in a single night. Armored samurai move through its streets while monsters drive the villagers toward them. A child watches the faction's leader kill his parents. Too young to fight and unable to save them, he survives only because they hid him before the attackers reached their home.

At dawn, he emerges into the ruins. He has no weapon capable of challenging the man responsible, no army, and no home to return to. He has a memory of the killer and a promise: he will become strong enough to face him.

Years of practice turn that promise into a dangerous purpose. When he begins his pursuit, nine dangerous followers stand between him and the antagonist; they control the routes and strongholds leading to their leader. Each opponent tests a weakness and demands greater mastery.

The final opponent is the man from his childhood. Reaching him proves the hero can survive his faction. Defeating him requires the discipline learned across the journey, rather than rage alone.

The leader's reason for attacking the village should matter to the wider story. It remains undecided; do not introduce a chosen-one prophecy, secret bloodline, resurrection, or supernatural pact as established canon.

## Opening cinematic — proposed

The current screenplay (≈75 seconds, eight scenes from "Before the fire" to "The hunt begins") is maintained as data in `src/cinematic/script.ts` and is previewable in the game. It ends on the on-screen text "Nine stand between you and revenge." followed by the game title.

The hiding place, wooden charm, dialogue, and exact staging are proposed screenplay details. The confirmed events are the village attack, the parents' deaths at the leader's hands, the child's survival, and the revenge-driven training. Names are placeholders: CHILD / ADULT PROTAGONIST, FATHER, MOTHER, ANTAGONIST. The antagonist must be recognizable by his face, armor emblem, and distinctive sword; their final designs are open.

## Campaign chapters — proposed

The structure is fixed at nine encounters followed by the leader at level 10. Chapter titles, locations, and combat lessons are draft organizing ideas.

| Levels | Working chapter | Narrative purpose | Combat focus | Arena direction |
| --- | --- | --- | --- | --- |
| 1–3 | The Outer Defenses | Confront the faction's outer fighters. | Movement, spacing, basic attacks, defense, and controlling aggression. | Abandoned roads, occupied outposts, village approaches. |
| 4–6 | The Pursuit | Move deeper into faction territory; reveal information about the faction and the village attack. | Distinctive enemy abilities, timing, resource management, and exploiting weaknesses. | Forests, ruined shrines, mountain crossings, captured settlements. |
| 7–9 | The Inner Circle | Defeat three elite followers who protect the leader. The ninth victory opens access to him. | Combining earlier lessons; preparation for the final battle. | A distinct arena for each elite fighter. |
| 10 | The Reckoning | Confront the leader responsible for the parents' deaths. | Dangerous but understandable attacks; victory depends on skills learned in the campaign. | A final arena reflecting his identity and power. |

Each preliminary level has its own named faction opponent, and each of the three elites needs a distinct personality, combat style, and arena. Background figures in the cinematic do not create additional roster slots.

Whether enemy characters become selectable in a separate versus mode is undecided; the 14-character roster does not establish 14 playable campaign heroes.

## Character and animation development

Develop a character sheet for all 14 fighters covering name, faction, story role, motivation, personality, silhouette, weapon, stance, strengths, weaknesses, powers, counterplay, and arena association. Enemy fighters also need their campaign position and the skill they test.

The four protagonists should offer different fighting styles with meaningful strengths and weaknesses. For each ability, define its visible warning, startup, reach, effect, cost, cooldown, recovery, and interruption rules.

Give each fighter a coherent 3D animation set: recognizable stance, convincing movement and turns, readable attack preparation, impact, recovery, defense, evasion, ability activation, hit reactions, defeat, and victory. Powerful attacks should have readable preparation and punishable recovery.

Do not assign existing prototype abilities to the new fighters by default. Design the four protagonist playstyles and the leader first, then build the nine followers around a deliberate difficulty curve.

## Still open

1. Final game name.
2. Character names, identities, and exact ages.
3. The antagonist's motive for attacking the village and why monsters serve his faction.
4. Final confirmation of the four protagonists' connection, and the three allies' backgrounds and motives.
5. Final powers, weapons, and abilities.
6. The exact survival mechanism and the keepsake's significance.
7. Whether enemy characters become playable in a separate versus mode.

The rebuild and authoritative multiplayer backend remain future implementation work.
