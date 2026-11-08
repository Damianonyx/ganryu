import { SHOTS as SCRIPT } from "@/cinematic/script";
import { ACT1 } from "./acts/act1";
import { ACT2 } from "./acts/act2";
import { ACT3 } from "./acts/act3";
import { ACT4 } from "./acts/act4";
import type { Shot } from "./lab";

/**
 * The 3D film's shots, in screenplay order. Each shot's length and fades come
 * from src/cinematic/script.ts, so the voices, music, and subtitles of the
 * painted film line up with it shot for shot.
 */

const STAGED: Shot[] = [...ACT1, ...ACT2, ...ACT3, ...ACT4];

export const SHOTS: Shot[] = STAGED.map((shot) => {
  const s = SCRIPT.find((x) => x.id === shot.id);
  if (!s) return shot;
  const dur = +(s.end - s.start).toFixed(3);
  if (Math.abs(dur - shot.dur) > 1e-6) console.warn(`shot ${shot.id}: staged for ${shot.dur} s, the script gives ${dur} s`);
  return { ...shot, dur, fadeIn: s.fadeIn, fadeOut: s.fadeOut, start: s.start } as Shot & { start: number };
}).sort((a, b) => ((a as Shot & { start?: number }).start ?? 0) - ((b as Shot & { start?: number }).start ?? 0));
