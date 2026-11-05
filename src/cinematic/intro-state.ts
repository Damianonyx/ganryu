/**
 * Remembers whether the opening cinematic was completed or explicitly
 * skipped. Stored under its own key so player saves (`ganryu-save-v1`,
 * `yonji-save-v1`) and the server save are never read or written here.
 */

export const INTRO_STATE_KEY = "ganryu-intro-v1";
export const INTRO_SUBTITLES_KEY = "ganryu-intro-subtitles";

export type IntroOutcome = "completed" | "skipped";

export type IntroRecord = {
  outcome: IntroOutcome;
  /** Script version the player saw; see INTRO_SCRIPT_VERSION. */
  version: number;
  at: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function storage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function parseIntroRecord(raw: string | null): IntroRecord | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<IntroRecord>;
    if ((v.outcome === "completed" || v.outcome === "skipped") && typeof v.version === "number")
      return { outcome: v.outcome, version: v.version, at: typeof v.at === "string" ? v.at : "" };
  } catch {
    /* corrupt value: treat as unseen */
  }
  return null;
}

export function readIntroRecord(store: StorageLike | null = storage()): IntroRecord | null {
  try {
    return parseIntroRecord(store?.getItem(INTRO_STATE_KEY) ?? null);
  } catch {
    return null;
  }
}

export function writeIntroRecord(outcome: IntroOutcome, version: number, store: StorageLike | null = storage(), now = new Date()) {
  const rec: IntroRecord = { outcome, version, at: now.toISOString() };
  try {
    store?.setItem(INTRO_STATE_KEY, JSON.stringify(rec));
  } catch {
    /* storage blocked: the intro will simply play again next visit */
  }
  return rec;
}

/**
 * URL override for previews and QA: `?intro=1` forces the film, `?intro=0`
 * suppresses it. Anything else defers to the stored record.
 */
export type IntroOverride = "force" | "suppress" | null;

export function parseIntroOverride(search: string): IntroOverride {
  const v = new URLSearchParams(search).get("intro");
  if (v === "1" || v === "force") return "force";
  if (v === "0" || v === "off") return "suppress";
  return null;
}

export function shouldAutoplayIntro(record: IntroRecord | null, override: IntroOverride, currentVersion: number): boolean {
  if (override === "force") return true;
  if (override === "suppress") return false;
  return !record || record.version < currentVersion;
}

export function readSubtitlesPref(store: StorageLike | null = storage()): boolean {
  try {
    return store?.getItem(INTRO_SUBTITLES_KEY) !== "0";
  } catch {
    return true;
  }
}

export function writeSubtitlesPref(on: boolean, store: StorageLike | null = storage()) {
  try {
    store?.setItem(INTRO_SUBTITLES_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}
