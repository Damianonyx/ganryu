import { create } from "zustand";
import type { CharId, GameMode, HudSnap, PlayKind, ResultKind } from "./types";

export type SaveState = {
  fighterId: CharId;
  maxLevel: number;
  currentLevel: number;
  wins: number;
  losses: number;
};

type GameState = {
  mode: GameMode;
  playKind: PlayKind;
  fighterId: CharId;
  level: number;
  maxLevel: number;
  wins: number;
  losses: number;
  muted: boolean;
  result: ResultKind;
  hud: HudSnap;
  room: string;
  roomPeers: number;
  setMode: (m: GameMode) => void;
  setFighter: (id: CharId) => void;
  setLevel: (n: number) => void;
  setMuted: (v: boolean) => void;
  setPlay: (level: number) => void;
  finish: (r: ResultKind) => void;
  applySave: (s: SaveState) => void;
  recordOutcome: (win: boolean) => void;
  setHud: (h: HudSnap) => void;
  setRoom: (code: string, peers: number) => void;
  backToTitle: () => void;
};

const emptyHud: HudSnap = {
  player: null,
  allies: [],
  enemies: [],
  fold: 0,
  foldMax: 3.1,
  power: 0,
  powerMax: 1,
  combo: 0,
  hint: "",
  clock: 0,
};

export const useGame = create<GameState>((set, get) => ({
  mode: "title",
  playKind: "watch",
  fighterId: "kage",
  level: 1,
  maxLevel: 1,
  wins: 0,
  losses: 0,
  muted: false,
  result: null,
  hud: emptyHud,
  room: "",
  roomPeers: 0,
  setMode: (mode) => set({ mode }),
  setFighter: (fighterId) => set({ fighterId }),
  setLevel: (level) => set({ level }),
  setMuted: (muted) => set({ muted }),
  setPlay: (level) => set({ mode: "play", level, result: null }),
  finish: (result) => set({ mode: "result", result }),
  applySave: (s) =>
    set({
      fighterId: s.fighterId,
      maxLevel: s.maxLevel,
      level: s.currentLevel,
      wins: s.wins,
      losses: s.losses,
    }),
  recordOutcome: (win) => {
    const s = get();
    if (win) {
      set({
        wins: s.wins + 1,
        maxLevel: Math.min(12, Math.max(s.maxLevel, s.level + 1)),
      });
    } else set({ losses: s.losses + 1 });
  },
  setHud: (hud) => set({ hud }),
  setRoom: (room, roomPeers) => set({ room, roomPeers }),
  backToTitle: () => set({ mode: "title", result: null, playKind: "watch" }),
}));
