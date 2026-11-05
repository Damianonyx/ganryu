import { FINAL_LEVEL } from "./levels";
import { PLAYABLE } from "./roster";
import type { CharId } from "./types";

export type SaveLike = { fighterId: string; maxLevel: number; currentLevel: number; wins: number; losses: number };

/**
 * Saves written by the 18-fighter / 12-level prototype keep their wins and
 * losses; an unknown fighter becomes Kairo and levels clamp to the campaign.
 * The stored save itself is only rewritten by the game's normal save path.
 */
export function migrateSave(s: SaveLike) {
  const known = PLAYABLE.some((c) => c.id === s.fighterId);
  const clamp = (n: number) => Math.max(1, Math.min(FINAL_LEVEL, Math.floor(Number(n) || 1)));
  return {
    fighterId: (known ? s.fighterId : "kairo") as CharId,
    maxLevel: clamp(s.maxLevel),
    currentLevel: clamp(s.currentLevel),
    wins: Math.max(0, Math.floor(Number(s.wins) || 0)),
    losses: Math.max(0, Math.floor(Number(s.losses) || 0)),
  };
}
