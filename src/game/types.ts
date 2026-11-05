export type CharId =
  // protagonists
  | "kairo"
  | "hakuren"
  | "shion"
  | "akari"
  // antagonists (campaign order)
  | "kurogane"
  | "sei"
  | "rei"
  | "mumyo"
  | "vargash"
  | "mokuren"
  | "gorvane"
  | "enjiro"
  | "kharzul"
  | "nethrak";

/** Fighter IDs from the prototype roster; old saves may still contain them. */
export const LEGACY_CHAR_IDS = [
  "kage", "karasu", "enma", "akatsuki", "akai", "yoru", "hana", "kabuto", "shiro",
  "ryu", "mizuchi", "akakage", "shizuka", "werewolf", "chimera", "hellwolf", "fieldoni", "titan",
] as const;

export type HatKind = "none" | "kasa" | "straw" | "kabuto" | "mask" | "hood" | "crown";
export type HairKind = "none" | "topknot" | "long" | "white-pony" | "bob" | "spiky" | "mane";
export type WeaponKind =
  | "katana"
  | "dual"
  | "naginata"
  | "bow"
  | "claws"
  | "scythes"
  | "staff"
  | "fists";
export type BodyKind = "human" | "beast" | "titan" | "thorn" | "abyss";
export type PowerKind =
  | "dash"
  | "aoe"
  | "dot"
  | "reflect"
  | "burst"
  | "slow"
  | "ranged"
  | "charge"
  | "homing"
  | "teleport"
  | "stun"
  | "iaido";

export type AnimName =
  | "idle"
  | "walk"
  | "slash"
  | "parry"
  | "leap"
  | "hurt"
  | "die"
  | "special"
  | "fold";

export type Kit = {
  body: BodyKind;
  hat: HatKind;
  hair: HairKind;
  weapons: WeaponKind;
  scale: number;
  cloth: string;
  accent: string;
  skin: string;
  metal: string;
  trim: string;
};

export type PowerDef = {
  id: string;
  name: string;
  desc: string;
  cd: number;
  kind: PowerKind;
};

export type CharacterDef = {
  id: CharId;
  name: string;
  kana: string;
  title: string;
  blurb: string;
  portrait: string;
  playable: boolean;
  unbeatable: boolean;
  rank: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  range: number;
  power: PowerDef;
  kit: Kit;
};

export type LevelDef = {
  id: number;
  name: string;
  kana: string;
  blurb: string;
  enemies: CharId[];
  hpMul: number;
  atkMul: number;
  spdMul: number;
  ai: "slow" | "normal" | "fast" | "elite" | "raid";
  arena: "mist" | "ember" | "grove" | "storm" | "void" | "blood";
};

export type GameMode = "title" | "select" | "levels" | "play" | "result" | "lobby";
export type PlayKind = "campaign" | "duel" | "coop" | "watch";
export type ResultKind = "win" | "lose" | null;

export type InputFrame = {
  mx: number;
  mz: number;
  slash: boolean;
  parry: boolean;
  leap: boolean;
  power: boolean;
  fold: boolean;
};

export type FighterSnap = {
  id: string;
  charId: CharId;
  hp: number;
  maxHp: number;
  x: number;
  z: number;
  yaw: number;
  folding: boolean;
  team: 0 | 1;
  dead: boolean;
};

export type HudSnap = {
  player: FighterSnap | null;
  allies: FighterSnap[];
  enemies: FighterSnap[];
  fold: number;
  foldMax: number;
  power: number;
  powerMax: number;
  combo: number;
  hint: string;
  clock: number;
};
