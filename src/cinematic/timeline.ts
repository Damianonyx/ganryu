import { CUES, FILM_DURATION, SHOTS, SOUND_EVENTS, type Cue, type Shot } from "./script.ts";

export type ShotFrame = {
  shot: Shot;
  index: number;
  /** Seconds since the shot started. */
  local: number;
  /** 0..1 progress through the shot. */
  p: number;
  /** 0..1 multiplier for fades to/from black. */
  fade: number;
};

export function shotAt(t: number, shots: Shot[] = SHOTS): ShotFrame {
  const clamped = Math.max(0, Math.min(t, shots[shots.length - 1].end - 1e-6));
  let index = shots.findIndex((s) => clamped >= s.start && clamped < s.end);
  if (index < 0) index = shots.length - 1;
  const shot = shots[index];
  const dur = shot.end - shot.start;
  const local = clamped - shot.start;
  let fade = 1;
  if (shot.fadeIn) fade = Math.min(fade, local / shot.fadeIn);
  if (shot.fadeOut) fade = Math.min(fade, (shot.end - clamped) / shot.fadeOut);
  return { shot, index, local, p: dur > 0 ? local / dur : 1, fade: Math.max(0, Math.min(1, fade)) };
}

export function cuesAt(t: number, cues: Cue[] = CUES): Cue[] {
  return cues.filter((c) => t >= c.start && t < c.end);
}

/** Problems with the script data; an empty list means it is valid. */
export function validateScript(shots: Shot[] = SHOTS, cues: Cue[] = CUES): string[] {
  const errors: string[] = [];
  if (shots.length === 0) return ["no shots"];
  if (shots[0].start !== 0) errors.push(`first shot starts at ${shots[0].start}, expected 0`);
  const ids = new Set<string>();
  shots.forEach((s, i) => {
    if (ids.has(s.id)) errors.push(`duplicate shot id ${s.id}`);
    ids.add(s.id);
    if (!(s.end > s.start)) errors.push(`shot ${s.id} has non-positive duration`);
    if (i > 0 && Math.abs(shots[i - 1].end - s.start) > 1e-9)
      errors.push(`gap/overlap between shot ${shots[i - 1].id} (${shots[i - 1].end}) and ${s.id} (${s.start})`);
    const fades = (s.fadeIn ?? 0) + (s.fadeOut ?? 0);
    if (fades > s.end - s.start) errors.push(`shot ${s.id} fades are longer than the shot`);
  });
  const end = shots[shots.length - 1].end;
  const byTrack = new Map<string, Cue[]>();
  for (const c of cues) {
    if (!(c.end > c.start)) errors.push(`cue "${c.lines[0]}" has non-positive duration`);
    if (c.start < 0 || c.end > end) errors.push(`cue "${c.lines[0]}" is outside the film`);
    if (c.track === "speech" && !c.speaker) errors.push(`speech cue "${c.lines[0]}" has no speaker`);
    if (c.lines.length === 0 || c.lines.some((l) => l.trim() === "")) errors.push(`cue at ${c.start} has empty lines`);
    const list = byTrack.get(c.track) ?? [];
    list.push(c);
    byTrack.set(c.track, list);
  }
  for (const [track, list] of byTrack) {
    const sorted = [...list].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++)
      if (sorted[i].start < sorted[i - 1].end)
        errors.push(`${track} cues overlap: "${sorted[i - 1].lines[0]}" and "${sorted[i].lines[0]}"`);
  }
  for (const e of SOUND_EVENTS) if (e.at < 0 || e.at > end) errors.push(`sound ${e.sound} at ${e.at} is outside the film`);
  return errors;
}

export { FILM_DURATION };
