import type { CharacterDef, CharId, Kit, PowerDef } from "./types";

/** Character art cut from the owner's turnaround sheets (docs/characters). */
const art = (id: CharId) => `/fighters/${id}/front34.webp`;

const kit = (body: Kit["body"], weapons: Kit["weapons"], scale: number, accent: string): Kit => ({
  body,
  hat: "none",
  hair: "none",
  weapons,
  scale,
  cloth: "#1a1a1e",
  accent,
  skin: "#2a2a2e",
  metal: "#c8c4b8",
  trim: "#6a6a70",
});

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
    kit: kit("human", "katana", 1, "#7a7aa0"),
  },
  {
    id: "hakuren", name: "Hakuren", kana: "白蓮", title: "The Pale Exile",
    blurb: "A cursed iaidō master. Slow to draw, terrible when he does.",
    portrait: art("hakuren"), playable: true, unbeatable: false, rank: 2,
    hp: 112, atk: 19, def: 7, spd: 0.94, range: 2.1,
    power: power("moonless-draw", "Moonless Draw", "A charged quick-draw that cuts through guards.", 8, "iaido"),
    kit: kit("human", "katana", 1.02, "#d8d4cc"),
  },
  {
    id: "shion", name: "Shion", kana: "紫苑", title: "The Veiled Rain",
    blurb: "A wandering staff fighter whose reach owns the middle distance.",
    portrait: art("shion"), playable: true, unbeatable: false, rank: 3,
    hp: 110, atk: 13, def: 10, spd: 1.0, range: 2.45,
    power: power("storm-circle", "Storm Circle", "A spinning sweep that strikes everyone nearby.", 8, "aoe"),
    kit: kit("human", "staff", 1, "#7f86a8"),
  },
  {
    id: "akari", name: "Akari", kana: "灯", title: "The Prayer Blade",
    blurb: "Fast and tricky. Her ward seals slow anyone who steps inside them.",
    portrait: art("akari"), playable: true, unbeatable: false, rank: 4,
    hp: 96, atk: 13, def: 6, spd: 1.22, range: 1.75,
    power: power("ward-seal", "Ward Seal", "A talisman ring that slows the foe.", 7, "slow"),
    kit: kit("human", "katana", 0.98, "#c23a3a"),
  },
  {
    id: "kurogane", name: "Kurogane", kana: "黒鉄", title: "The Iron Vow",
    blurb: "The faction's gatekeeper. Honest steel and a guard-breaking blow.",
    portrait: art("kurogane"), playable: false, unbeatable: false, rank: 14,
    hp: 105, atk: 11, def: 9, spd: 0.95, range: 1.8,
    power: power("iron-vow", "Iron Vow", "A heavy blow that staggers.", 9, "stun"),
    kit: kit("human", "katana", 1.03, "#b08a50"),
  },
  {
    id: "sei", name: "Sei", kana: "清", title: "The Silver Hollow",
    blurb: "One of the twins. Vanishes into smoke and strikes from where you are not looking.",
    portrait: art("sei"), playable: false, unbeatable: false, rank: 13,
    hp: 92, atk: 12, def: 5, spd: 1.16, range: 1.6,
    power: power("smoke-step", "Smoke Step", "Teleports behind the foe.", 7, "teleport"),
    kit: kit("human", "claws", 1, "#e6e8f0"),
  },
  {
    id: "rei", name: "Rei", kana: "零", title: "The Violet Hunger",
    blurb: "The other twin. Long thorned claws and a pounce that closes any gap.",
    portrait: art("rei"), playable: false, unbeatable: false, rank: 12,
    hp: 110, atk: 13, def: 6, spd: 1.1, range: 2.0,
    power: power("pounce", "Violet Pounce", "A lunging charge.", 7, "charge"),
    kit: kit("beast", "claws", 1.05, "#9b5cff"),
  },
  {
    id: "mumyo", name: "Mumyō", kana: "無明", title: "The Bound Grin",
    blurb: "A bandaged duelist whose delayed cuts punish every wasted swing.",
    portrait: art("mumyo"), playable: false, unbeatable: false, rank: 11,
    hp: 112, atk: 15, def: 7, spd: 1.2, range: 1.85,
    power: power("cyan-cut", "Cyan Cut", "A sudden critical slash.", 7, "burst"),
    kit: kit("human", "katana", 1.02, "#46d6e0"),
  },
  {
    id: "vargash", name: "Vargash", kana: "夜吼", title: "The Night Howl",
    blurb: "A winged beast who dives from above. Its howl freezes the careless.",
    portrait: art("vargash"), playable: false, unbeatable: false, rank: 10,
    hp: 150, atk: 16, def: 9, spd: 1.05, range: 2.0,
    power: power("howl", "Night Howl", "A stunning roar.", 9, "stun"),
    kit: kit("beast", "fists", 1.25, "#e07030"),
  },
  {
    id: "mokuren", name: "Mokuren", kana: "木蓮", title: "The Hollow Monk",
    blurb: "A dead-wood spirit who answers every predictable attack with a counter.",
    portrait: art("mokuren"), playable: false, unbeatable: false, rank: 9,
    hp: 140, atk: 16, def: 11, spd: 0.98, range: 2.0,
    power: power("hollow-counter", "Hollow Counter", "Reflects the next blow.", 8, "reflect"),
    kit: kit("human", "katana", 1.06, "#c8a070"),
  },
  {
    id: "gorvane", name: "Gorvane", kana: "紅壁", title: "The Crimson Bastion",
    blurb: "Spiked armour and an unstoppable charge. Patience beats him; mashing does not.",
    portrait: art("gorvane"), playable: false, unbeatable: false, rank: 8,
    hp: 210, atk: 17, def: 16, spd: 0.82, range: 1.9,
    power: power("bastion-charge", "Bastion Charge", "A crushing armoured charge.", 8, "charge"),
    kit: kit("human", "fists", 1.18, "#d21e3c"),
  },
  {
    id: "enjiro", name: "Enjirō", kana: "炎次郎", title: "The Burning Oni",
    blurb: "A burning rōnin who never stops pressing. Every cut leaves fire behind.",
    portrait: art("enjiro"), playable: false, unbeatable: false, rank: 7,
    hp: 170, atk: 19, def: 10, spd: 1.08, range: 1.95,
    power: power("oni-fire", "Oni Fire", "Leaves a burning trail.", 8, "dot"),
    kit: kit("human", "katana", 1.04, "#ff5a2a"),
  },
  {
    id: "kharzul", name: "Kharzul", kana: "荊手", title: "The Hand of Thorns",
    blurb: "Second in command. His thorned chains reap from far beyond a sword's reach.",
    portrait: art("kharzul"), playable: false, unbeatable: false, rank: 6,
    hp: 190, atk: 19, def: 11, spd: 1.0, range: 2.6,
    power: power("chain-reap", "Chain Reap", "Hurls thorned sickles at the foe.", 7, "ranged"),
    kit: kit("human", "scythes", 1.12, "#e0203a"),
  },
  {
    id: "nethrak", name: "Nethrak", kana: "常夜", title: "The Eternal Nightmare",
    blurb: "The leader who burned the village. His red blade is slow to rise and devastating to land.",
    portrait: art("nethrak"), playable: false, unbeatable: false, rank: 5,
    hp: 260, atk: 22, def: 14, spd: 1.0, range: 2.5,
    power: power("nightmare-cleave", "Nightmare Cleave", "A huge, readable cleave.", 8, "burst"),
    kit: kit("human", "katana", 1.12, "#ff1f2e"),
  },
];

const BY_ID = new Map(ROSTER.map((c) => [c.id, c]));

export function getChar(id: CharId): CharacterDef {
  return BY_ID.get(id) ?? ROSTER[0];
}

export const PLAYABLE = ROSTER.filter((c) => c.playable);
export const BOSSES = ROSTER.filter((c) => c.unbeatable);
