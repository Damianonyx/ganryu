import { create } from "zustand";

export type Mode = "title" | "watch" | "duel" | "result";
export type FighterId = "ren" | "kai";

type DuelState = {
  mode: Mode;
  muted: boolean;
  reducedMotion: boolean;
  shake: boolean;
  hud: boolean;
  renHits: number;
  kaiHits: number;
  toWin: number;
  winner: FighterId | null;
  clashes: number;
  help: boolean;
  start: (mode: "watch" | "duel") => void;
  setMuted: (v: boolean) => void;
  setShake: (v: boolean) => void;
  setHud: (v: boolean) => void;
  setHelp: (v: boolean) => void;
  registerHit: (who: FighterId) => void;
  registerClash: () => void;
  finish: (winner: FighterId) => void;
  resetScores: () => void;
  backToTitle: () => void;
};

const TO_WIN = 3;

export const useDuel = create<DuelState>((set, get) => ({
  mode: "title",
  muted: false,
  reducedMotion: false,
  shake: true,
  hud: true,
  renHits: 0,
  kaiHits: 0,
  toWin: TO_WIN,
  winner: null,
  clashes: 0,
  help: false,
  start: (mode) =>
    set({
      mode,
      winner: null,
      renHits: 0,
      kaiHits: 0,
      clashes: 0,
      help: mode === "duel",
    }),
  setMuted: (muted) => set({ muted }),
  setShake: (shake) => set({ shake }),
  setHud: (hud) => set({ hud }),
  setHelp: (help) => set({ help }),
  registerHit: (who) => {
    const next = who === "ren" ? { renHits: get().renHits + 1 } : { kaiHits: get().kaiHits + 1 };
    set(next);
    const s = get();
    if (s.mode !== "duel") return;
    if (s.renHits >= s.toWin) set({ mode: "result", winner: "kai" });
    if (s.kaiHits >= s.toWin) set({ mode: "result", winner: "ren" });
  },
  registerClash: () => set({ clashes: get().clashes + 1 }),
  finish: (winner) => set({ mode: "result", winner }),
  resetScores: () => set({ renHits: 0, kaiHits: 0, clashes: 0, winner: null }),
  backToTitle: () =>
    set({
      mode: "title",
      winner: null,
      renHits: 0,
      kaiHits: 0,
      clashes: 0,
      help: false,
    }),
}));
