# Character roster — draft 1

The 14 named fighters: four playable protagonists and ten antagonists. The reference sheets were supplied by the project owner. The names and epithets are approved as working names ("okay for now") and may still change.

**Status of each detail:**
- **Confirmed by the project owner:** the cast and their designs, Nethrak's role as leader, Kharzul as second in command, Sei and Rei as twins with silver-white and violet accents, Kairo as the village survivor, and the other three protagonists meeting him along the way.
- **Proposals awaiting design work:** fighting styles, skills, and the campaign order.

Internal IDs are stable lowercase keys. Display names can change without breaking saves.

**In the game:**
- The roster and the ten-battle campaign are implemented (`src/game/roster.ts`, `src/game/levels.ts`).
- The warrior-select screen shows the four protagonists with their skills and stats.
- In matches, the nine human fighters (all four protagonists, Kurogane, Mumyō, Mokuren, Enjirō, and Nethrak) use a procedural armored-samurai body (`src/game/rig-samurai.ts`) built from their sheets: lacquer armor with laced plates, helmets, hats or masks, and each character's signature details. Sei, Rei, Vargash, Gorvane, and Kharzul still use the earlier prototype bodies, now facing forward and studio-lit; rebuilding them in the new style is planned.
- Each fighter has one Art power plus Fold. The select screen badges the skill that works in battle now (Kairo: Shadow Step, Hakuren: Moonless Draw, Shion: Storm Circle, Akari: Ward Seal) and marks the rest "Soon". The skill kits below are the design target.
- Kairo's armor lacing is ember orange (for The Last Ember); his sheet's accent was too dark to read on black lacquer.

## Protagonists

Players choose one protagonist and keep that fighter for the whole campaign. Each must be able to finish all ten levels through skill.

| ID | Name | Sheet | Role in the story | Proposed style | Strength / weakness |
| --- | --- | --- | --- | --- | --- |
| `kairo` | **Kairo, The Last Ember** | [sheet](characters/kairo.webp) | **Main character.** The village survivor shown in the opening cinematic. | All-rounder swordsman; the easiest to learn, the best at combos | Good at everything / best at nothing |
| `hakuren` | **Hakuren, The Pale Exile** | [sheet](characters/hakuren.webp) | Ally met along the way; his motive is undecided | Iaidō counter swordsman: slow, long reach, very high damage | Wins exchanges with one punish / vulnerable when rushed |
| `shion` | **Shion, The Veiled Rain** | [sheet](characters/shion.webp) | Ally met along the way; her motive is undecided | Staff fighter: longest reach, sweeps and knockdowns, zone control | Dominates mid range / struggles up close |
| `akari` | **Akari, The Prayer Blade** | [sheet](characters/akari.webp) | Ally met along the way; her motive is undecided | Fast technical fighter with ward seals and a bead-chain whip | Fastest and trickiest / lowest health |

Kairo, Hakuren, Shion, and Akari are two male and two female samurai. Only Kairo comes from the destroyed village. Do not give the allies the same childhood history.

### Proposed skills

| Fighter | Skill 1 | Skill 2 | Skill 3 | Ultimate |
| --- | --- | --- | --- | --- |
| Kairo | **Shadow Step**: short dash through the opponent, leaving an afterimage | **Scarf Bind**: the shadow scarf lashes out at mid range to pull or interrupt | **Steady Stance**: parry; perfect timing triggers a riposte ("Steady your feet") | **Unbroken Resolve**: a rage meter fills as he takes damage. Releasing it at the right moment empowers him; wasting it lowers his defense. |
| Hakuren | **Moonless Draw**: charged quick-draw slash | **White Thread**: his hair deflects one attack | **Curse Price**: spends his own health to add damage | **Thousand Pale Cuts** |
| Shion | **Rain Sweep**: wide low sweep | **Pole Vault**: vaults over the opponent | **Binding Wraps**: cloth wraps stun briefly | **Storm Circle**: spinning staff |
| Akari | **Bead Snap**: mid-range bead-chain whip | **Ward Seal**: talisman zone that slows enemies | **Petal Rush**: multi-hit dash | **Hundred Prayers** |

## Antagonists

Nine followers and their leader. Level 10 stays locked until all nine followers are defeated.

| Level | ID | Name | Sheet | Look | Proposed skills | Lesson for the player |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `kurogane` | **Kurogane, The Iron Vow** | [sheet](characters/kurogane.webp) | Black-robed samurai, horned kabuto, masked | Honest sword strings, guard break | Fundamentals |
| 2 | `sei` | **Sei, The Silver Hollow** | [sheet](characters/sei.webp) | Smoke-tendril shadow; **silver-white** eyes, grin, and light lines | Smoke teleport, feints, fade | Reading feints |
| 3 | `rei` | **Rei, The Violet Hunger** | [sheet](characters/rei.webp) | Thorned claw shadow; **violet** eyes, bark cracks, and claw trails | Long claws, pounce, burrowing thorns | Spacing against reach |
| 4 | `mumyo` | **Mumyō, The Bound Grin** | [sheet](characters/mumyo.webp) | Bandaged swordsman, cyan eyes and blade hilt | Blinding cyan dashes, delayed slash | Punishing whiffs |
| 5 | `vargash` | **Vargash, The Night Howl** | [sheet](characters/vargash.webp) | Winged bat-wolf beast with a bone gauntlet and chains | Air dives, stunning howl, frenzy | Anti-air and defense |
| 6 | `mokuren` | **Mokuren, The Hollow Monk** | [sheet](characters/mokuren.webp) | Dead-wood spirit monk, prayer beads, katana | Iaidō counters, root snares | Not being predictable; can reveal faction secrets |
| 7 | `gorvane` | **Gorvane, The Crimson Bastion** | [sheet](characters/gorvane.webp) | Massive spiked black-and-crimson armor | Super-armored charge, spike retaliation, crushing grab | Patience; mashing gets punished |
| 8 | `enjiro` | **Enjirō, The Burning Oni** | [sheet](characters/enjiro.webp) | Straw-hat rōnin, red oni horn, burning demon arm, red katana | Flame combos, burn damage over time | Defending under pressure |
| 9 | `kharzul` | **Kharzul, The Hand of Thorns** | [sheet](characters/kharzul.webp) | **Second in command.** Spined crown, beaked helm, thorn chains with sickle talons | Chain reap pull, thorn cage, sickle storm | Closing distance on a zoner |
| 10 | `nethrak` | **Nethrak, The Eternal Nightmare** | [sheet](characters/nethrak.webp) | **Leader.** Conical steel hat, skull face, red eyes, white robe with crimson flames, oversized red blade | **Nightmare Cleave**: huge arc with a readable wind-up. **Executioner's Mark**: debuff on the target. **Red Brushstroke**: lingering slash lines on the ground. | Everything the campaign taught |

**Chapters:**
- **Levels 1–3 (The Outer Defenses):** Kurogane and the twins.
- **Levels 4–6 (The Pursuit):** Mumyō, Vargash, and Mokuren.
- **Levels 7–9 (The Inner Circle):** Gorvane, Enjirō, and Kharzul.

### Design notes

- **At the village attack (owner-approved):** Nethrak led the raid. Kurogane led the samurai through the gate, the twins Sei and Rei moved through the forest, Vargash broke the gate, and Kharzul waited with Kurogane in the doorway while Nethrak killed the parents. Gorvane, Enjirō, Mumyō, and Mokuren were not present, which leaves the story free to introduce them later.

- **Nethrak in the opening cinematic.** The child recognizes him by his skull face beneath the conical hat and by his oversized red blade. The owner decided not to use an armor emblem.
- **Sei and Rei** are twins. They share a look but have different abilities, and the silver-white or violet color marks each twin's attacks as well as their body.
- **Nethrak in PvP.** He is the strongest fighter in the lore. If he becomes playable in a versus mode, that version is balanced like any other fighter.
- **Skill specifications.** Each skill still needs a visible warning, startup, reach, effect, cost, cooldown, recovery, and interruption rules before implementation.
- **Animation.** Every fighter needs a distinct stance, movement, attack preparation, impact, recovery, defense, defeat, and victory animation.

## Still open

- The three allies' backgrounds and motives, and how Kairo meets each of them.
- Nethrak's motive for attacking the village, and why monsters serve the faction.
- Final names, exact numbers, and skill balance.
- Whether antagonists become selectable in a separate versus mode.
