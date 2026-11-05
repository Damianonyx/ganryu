import type { LevelDef } from "./types";

/**
 * Campaign: nine followers, then Nethrak at level 10 (docs/CHARACTERS.md).
 * Chapter 1 (1–3) The Outer Defenses · Chapter 2 (4–6) The Pursuit ·
 * Chapter 3 (7–9) The Inner Circle · Level 10 The Reckoning.
 */
export const LEVELS: LevelDef[] = [
  { id: 1, name: "The Iron Gate", kana: "鉄門", blurb: "Kurogane holds the road out of the ashes. Learn to cut, parry, and wait.", enemies: ["kurogane"], hpMul: 0.85, atkMul: 0.7, spdMul: 0.85, ai: "slow", arena: "mist" },
  { id: 2, name: "Silver Smoke", kana: "銀煙", blurb: "Sei fades and returns. Do not chase the feint.", enemies: ["sei"], hpMul: 0.95, atkMul: 0.8, spdMul: 0.92, ai: "normal", arena: "mist" },
  { id: 3, name: "Violet Thorns", kana: "紫棘", blurb: "Rei's claws reach further than yours. Own the distance.", enemies: ["rei"], hpMul: 1, atkMul: 0.88, spdMul: 0.95, ai: "normal", arena: "grove" },
  { id: 4, name: "The Bound Grin", kana: "無明", blurb: "Mumyō punishes every wasted swing. Make him miss first.", enemies: ["mumyo"], hpMul: 1, atkMul: 0.92, spdMul: 1, ai: "fast", arena: "storm" },
  { id: 5, name: "Night Howl", kana: "夜吼", blurb: "Vargash dives from above. Guard, then strike as it lands.", enemies: ["vargash"], hpMul: 1, atkMul: 0.95, spdMul: 1, ai: "fast", arena: "grove" },
  { id: 6, name: "Hollow Shrine", kana: "空寺", blurb: "Mokuren counters the predictable. The monk knows why the village burned.", enemies: ["mokuren"], hpMul: 1.02, atkMul: 1, spdMul: 1, ai: "elite", arena: "void" },
  { id: 7, name: "The Crimson Bastion", kana: "紅壁", blurb: "The first of the Inner Circle. Patience breaks armour.", enemies: ["gorvane"], hpMul: 1.05, atkMul: 1, spdMul: 1, ai: "elite", arena: "ember" },
  { id: 8, name: "Burning Oni", kana: "炎鬼", blurb: "Enjirō never stops pressing. Defend, then answer.", enemies: ["enjiro"], hpMul: 1.08, atkMul: 1.02, spdMul: 1.02, ai: "elite", arena: "ember" },
  { id: 9, name: "Hand of Thorns", kana: "荊手", blurb: "Kharzul guards the last door. Close the distance through his chains.", enemies: ["kharzul"], hpMul: 1.1, atkMul: 1.04, spdMul: 1.02, ai: "elite", arena: "blood" },
  { id: 10, name: "The Reckoning", kana: "決着", blurb: "Nethrak. Everything you learned, against the man who took them.", enemies: ["nethrak"], hpMul: 1.12, atkMul: 1.05, spdMul: 1.04, ai: "elite", arena: "blood" },
];

export const FINAL_LEVEL = LEVELS.length;

export function getLevel(id: number): LevelDef {
  return LEVELS.find((x) => x.id === id) ?? LEVELS[0];
}
