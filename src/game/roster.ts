import type { CharacterDef, CharId, Kit, PowerDef } from "./types";

/** Character art cut from the owner's turnaround sheets (docs/characters). */
const art = (id: CharId) => `/fighters/${id}/front34.webp`;

/** 3D look for each fighter, matched to their character sheet. */
const LOOKS: Record<CharId, Omit<Kit, "scale">> = {
  kairo: { body: "human", hat: "kabuto", hair: "none", weapons: "katana", cloth: "#121216", accent: "#4a4a62", skin: "#1c1c22", metal: "#b8bac8", trim: "#2a2a34" },
  hakuren: { body: "human", hat: "mask", hair: "long", weapons: "katana", cloth: "#d9d6d0", accent: "#2c2c30", skin: "#3a2e2a", metal: "#d4d6de", trim: "#ecebe6" },
  shion: { body: "human", hat: "kasa", hair: "long", weapons: "staff", cloth: "#3a3a46", accent: "#5c5c6e", skin: "#e6c8b0", metal: "#b8b0a0", trim: "#24242c" },
  akari: { body: "human", hat: "none", hair: "white-pony", weapons: "katana", cloth: "#d8d2c6", accent: "#b42a2a", skin: "#ecd2ba", metal: "#c8b070", trim: "#8a1f1f" },
  kurogane: { body: "human", hat: "kabuto", hair: "none", weapons: "katana", cloth: "#0e0e10", accent: "#242428", skin: "#18181c", metal: "#b08a50", trim: "#1e1e22" },
  sei: { body: "abyss", hat: "none", hair: "spiky", weapons: "claws", cloth: "#050506", accent: "#e6e8f0", skin: "#0a0a0c", metal: "#e6e8f0", trim: "#c8ccd8" },
  rei: { body: "thorn", hat: "none", hair: "spiky", weapons: "claws", cloth: "#0a090c", accent: "#9b5cff", skin: "#121016", metal: "#9b5cff", trim: "#6a3cc0" },
  mumyo: { body: "human", hat: "mask", hair: "none", weapons: "katana", cloth: "#2a3440", accent: "#46d6e0", skin: "#d8d4cc", metal: "#c8e8ec", trim: "#5a6a78" },
  vargash: { body: "beast", hat: "none", hair: "mane", weapons: "fists", cloth: "#1c1c20", accent: "#e07030", skin: "#4a4e54", metal: "#c8b890", trim: "#3a3a40" },
  mokuren: { body: "human", hat: "crown", hair: "none", weapons: "katana", cloth: "#4a3a52", accent: "#8a5a30", skin: "#b0a898", metal: "#c8c4b8", trim: "#e8e0d0" },
  gorvane: { body: "titan", hat: "crown", hair: "none", weapons: "fists", cloth: "#0e0e10", accent: "#d21e3c", skin: "#1a1214", metal: "#d21e3c", trim: "#5a0e18" },
  enjiro: { body: "human", hat: "straw", hair: "long", weapons: "katana", cloth: "#1a1416", accent: "#ff3a2a", skin: "#8a5a40", metal: "#ff5a3a", trim: "#7a1a14" },
  kharzul: { body: "thorn", hat: "crown", hair: "none", weapons: "scythes", cloth: "#3a3236", accent: "#e0203a", skin: "#6a1a1e", metal: "#e0203a", trim: "#9a1428" },
  nethrak: { body: "human", hat: "kasa", hair: "none", weapons: "katana", cloth: "#dcd8d2", accent: "#c81e2a", skin: "#e0d8c8", metal: "#d0202c", trim: "#8a1418" },
};

const kit = (id: CharId, scale: number): Kit => ({ ...LOOKS[id], scale });

const power = (id: string, name: string, desc: string, cd: number, kind: PowerDef["kind"]): PowerDef => ({ id, name, desc, cd, kind });

/**
 * The 14-fighter roster (docs/CHARACTERS.md). Names are approved working
 * names; stats and powers are first-pass balance values.
 */
export const ROSTER: CharacterDef[] = [
  {
    id: "kairo", name: "Kairo", kana: "灰炉", title: "The Last Ember",
    blurb: "The village survivor. A balanced blade who learned to steady his feet — and his anger.",
    portrait: art("kairo"), playable: true, unbeatable: false, rank: 1,
    hp: 120, atk: 15, def: 9, spd: 1.06, range: 1.8,
    power: power("shadow-step", "Shadow Step", "Dash through the foe, leaving an afterimage.", 7, "dash"),
    kit: kit("kairo", 1),
  },
  {
    id: "hakuren", name: "Hakuren", kana: "白蓮", title: "The Pale Exile",
    blurb: "A cursed iaidō master. Slow to draw, terrible when he does.",
    portrait: art("hakuren"), playable: true, unbeatable: false, rank: 2,
    hp: 112, atk: 19, def: 7, spd: 0.94, range: 2.1,
    power: power("moonless-draw", "Moonless Draw", "A charged quick-draw that cuts through guards.", 8, "iaido"),
    kit: kit("hakuren", 1.02),
  },
  {
    id: "shion", name: "Shion", kana: "紫苑", title: "The Veiled Rain",
    blurb: "A wandering staff fighter whose reach owns the middle distance.",
    portrait: art("shion"), playable: true, unbeatable: false, rank: 3,
    hp: 110, atk: 13, def: 10, spd: 1.0, range: 2.45,
    power: power("storm-circle", "Storm Circle", "A spinning sweep that strikes everyone nearby.", 8, "aoe"),
    kit: kit("shion", 1),
  },
  {
    id: "akari", name: "Akari", kana: "灯", title: "The Prayer Blade",
    blurb: "Fast and tricky. Her ward seals slow anyone who steps inside them.",
    portrait: art("akari"), playable: true, unbeatable: false, rank: 4,
    hp: 96, atk: 13, def: 6, spd: 1.22, range: 1.75,
    power: power("ward-seal", "Ward Seal", "A talisman ring that slows the foe.", 7, "slow"),
    kit: kit("akari", 0.98),
  },
  {
    id: "kurogane", name: "Kurogane", kana: "黒鉄", title: "The Iron Vow",
    blurb: "The faction's gatekeeper. Honest steel and a guard-breaking blow.",
    portrait: art("kurogane"), playable: false, unbeatable: false, rank: 14,
    hp: 105, atk: 11, def: 9, spd: 0.95, range: 1.8,
    power: power("iron-vow", "Iron Vow", "A heavy blow that staggers.", 9, "stun"),
    kit: kit("kurogane", 1.03),
  },
  {
    id: "sei", name: "Sei", kana: "清", title: "The Silver Hollow",
    blurb: "One of the twins. Vanishes into smoke and strikes from where you are not looking.",
    portrait: art("sei"), playable: false, unbeatable: false, rank: 13,
    hp: 92, atk: 12, def: 5, spd: 1.16, range: 1.6,
    power: power("smoke-step", "Smoke Step", "Teleports behind the foe.", 7, "teleport"),
    kit: kit("sei", 1),
  },
  {
    id: "rei", name: "Rei", kana: "零", title: "The Violet Hunger",
    blurb: "The other twin. Long thorned claws and a pounce that closes any gap.",
    portrait: art("rei"), playable: false, unbeatable: false, rank: 12,
    hp: 110, atk: 13, def: 6, spd: 1.1, range: 2.0,
    power: power("pounce", "Violet Pounce", "A lunging charge.", 7, "charge"),
    kit: kit("rei", 1.05),
  },
  {
    id: "mumyo", name: "Mumyō", kana: "無明", title: "The Bound Grin",
    blurb: "A bandaged duelist whose delayed cuts punish every wasted swing.",
    portrait: art("mumyo"), playable: false, unbeatable: false, rank: 11,
    hp: 112, atk: 15, def: 7, spd: 1.2, range: 1.85,
    power: power("cyan-cut", "Cyan Cut", "A sudden critical slash.", 7, "burst"),
    kit: kit("mumyo", 1.02),
  },
  {
    id: "vargash", name: "Vargash", kana: "夜吼", title: "The Night Howl",
    blurb: "A winged beast who dives from above. Its howl freezes the careless.",
    portrait: art("vargash"), playable: false, unbeatable: false, rank: 10,
    hp: 150, atk: 16, def: 9, spd: 1.05, range: 2.0,
    power: power("howl", "Night Howl", "A stunning roar.", 9, "stun"),
    kit: kit("vargash", 1.25),
  },
  {
    id: "mokuren", name: "Mokuren", kana: "木蓮", title: "The Hollow Monk",
    blurb: "A dead-wood spirit who answers every predictable attack with a counter.",
    portrait: art("mokuren"), playable: false, unbeatable: false, rank: 9,
    hp: 140, atk: 16, def: 11, spd: 0.98, range: 2.0,
    power: power("hollow-counter", "Hollow Counter", "Reflects the next blow.", 8, "reflect"),
    kit: kit("mokuren", 1.06),
  },
  {
    id: "gorvane", name: "Gorvane", kana: "紅壁", title: "The Crimson Bastion",
    blurb: "Spiked armour and an unstoppable charge. Patience beats him; mashing does not.",
    portrait: art("gorvane"), playable: false, unbeatable: false, rank: 8,
    hp: 210, atk: 17, def: 16, spd: 0.82, range: 1.9,
    power: power("bastion-charge", "Bastion Charge", "A crushing armoured charge.", 8, "charge"),
    kit: kit("gorvane", 1.18),
  },
  {
    id: "enjiro", name: "Enjirō", kana: "炎次郎", title: "The Burning Oni",
    blurb: "A burning rōnin who never stops pressing. Every cut leaves fire behind.",
    portrait: art("enjiro"), playable: false, unbeatable: false, rank: 7,
    hp: 170, atk: 19, def: 10, spd: 1.08, range: 1.95,
    power: power("oni-fire", "Oni Fire", "Leaves a burning trail.", 8, "dot"),
    kit: kit("enjiro", 1.04),
  },
  {
    id: "kharzul", name: "Kharzul", kana: "荊手", title: "The Hand of Thorns",
    blurb: "Second in command. His thorned chains reap from far beyond a sword's reach.",
    portrait: art("kharzul"), playable: false, unbeatable: false, rank: 6,
    hp: 190, atk: 19, def: 11, spd: 1.0, range: 2.6,
    power: power("chain-reap", "Chain Reap", "Hurls thorned sickles at the foe.", 7, "ranged"),
    kit: kit("kharzul", 1.12),
  },
  {
    id: "nethrak", name: "Nethrak", kana: "常夜", title: "The Eternal Nightmare",
    blurb: "The leader who burned the village. His red blade is slow to rise and devastating to land.",
    portrait: art("nethrak"), playable: false, unbeatable: false, rank: 5,
    hp: 260, atk: 22, def: 14, spd: 1.0, range: 2.5,
    power: power("nightmare-cleave", "Nightmare Cleave", "A huge, readable cleave.", 8, "burst"),
    kit: kit("nethrak", 1.12),
  },
];

const BY_ID = new Map(ROSTER.map((c) => [c.id, c]));

export function getChar(id: CharId): CharacterDef {
  return BY_ID.get(id) ?? ROSTER[0];
}

export const PLAYABLE = ROSTER.filter((c) => c.playable);
export const BOSSES = ROSTER.filter((c) => c.unbeatable);
