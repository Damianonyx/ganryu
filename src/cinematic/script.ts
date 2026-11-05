/**
 * Opening cinematic — editable screenplay data.
 *
 * Everything a writer or director is likely to revise lives in this file:
 * shot timing, the image each shot draws, subtitles/dialogue, sound cues, and
 * the end-card copy. The painter (`painter.ts`) and sound design (`score.ts`)
 * read it; neither hard-codes story content.
 *
 * Status: DRAFT TREATMENT. Names are placeholders. The charm, the cellar,
 * dialogue, and staging are proposals, not canon (see docs/STORYLINE.md).
 *
 * Editing rules (enforced by `validateScript` and src/cinematic/cinematic.test.ts):
 * - Shots must be contiguous: each `start` equals the previous `end`.
 * - Cues must lie inside the film and must not overlap another cue on the
 *   same track (dialogue/voice-over share the "speech" track).
 * - Times are seconds from the start of the film.
 * - Bump `INTRO_SCRIPT_VERSION` when a change is large enough that players
 *   who already watched should see it again on their next visit.
 */

export const INTRO_SCRIPT_VERSION = 2;

/** Placeholder display names. Final names are undecided. */
export const SPEAKERS = {
  child: "CHILD",
  adult: "ADULT PROTAGONIST",
  father: "FATHER",
  mother: "MOTHER",
  antagonist: "ANTAGONIST",
} as const;

export type SpeakerId = keyof typeof SPEAKERS;

/** Chapter-level scenes from the treatment. */
export const SCENES = [
  { id: "before", title: "Before the fire", start: 0, end: 9 },
  { id: "attack", title: "The attack", start: 9, end: 18 },
  { id: "hiding", title: "The hiding place", start: 18, end: 28 },
  { id: "remember", title: "The man he will remember", start: 28, end: 40 },
  { id: "buried", title: "Buried beneath the ruins", start: 40, end: 49 },
  { id: "survivor", title: "The survivor", start: 49, end: 58 },
  { id: "years", title: "The years between", start: 58, end: 70 },
  { id: "hunt", title: "The hunt begins", start: 70, end: 76 },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];

/**
 * Names of the drawing routines in `painter.ts`. Adding a shot kind means
 * adding a routine there; reordering or retiming shots only needs this file.
 */
export type ShotKind =
  | "village-evening"
  | "practice"
  | "mother-calls"
  | "bell"
  | "gate-threat"
  | "arrow-fire"
  | "gate-breach"
  | "hatch-open"
  | "grip-sleeve"
  | "charm-hand"
  | "hatch-close"
  | "door-breaks"
  | "antagonist-enters"
  | "emblem-insert"
  | "sword-face"
  | "father-falls"
  | "child-fear"
  | "hand-falls"
  | "ceiling-fire"
  | "beam-falls"
  | "cellar-dark"
  | "dawn-emerge"
  | "ruins-search"
  | "kneel"
  | "first-stance"
  | "montage-rain"
  | "montage-knocked"
  | "montage-wrist"
  | "montage-snow"
  | "montage-fall"
  | "montage-attempt"
  | "match-cut"
  | "tie-charm"
  | "fortress-draw"
  | "black"
  | "tagline"
  | "title";

export type Shot = {
  id: string;
  scene: SceneId;
  start: number;
  end: number;
  kind: ShotKind;
  /** Plain-language description for reviewers and the contact sheet. */
  note: string;
  /** Fade from black over this many seconds (default: hard cut). */
  fadeIn?: number;
  /** Fade to black over this many seconds before `end`. */
  fadeOut?: number;
};

export const SHOTS: Shot[] = [
  // 00:00–00:09 BEFORE THE FIRE
  { id: "1a", scene: "before", start: 0, end: 3.4, kind: "village-evening", fadeIn: 1.4, note: "Evening over a mountain village; lanterns glow outside wooden homes." },
  { id: "1b", scene: "before", start: 3.4, end: 6.8, kind: "practice", note: "The boy swings a wooden sword, overbalances; his father catches him and sets his feet." },
  { id: "1c", scene: "before", start: 6.8, end: 9, kind: "mother-calls", note: "His mother calls from the doorway; the boy runs toward her." },

  // 00:09–00:18 THE ATTACK
  { id: "2a", scene: "attack", start: 9, end: 11, kind: "bell", note: "A warning bell rings. The father's smile disappears." },
  { id: "2b", scene: "attack", start: 11, end: 14, kind: "gate-threat", note: "Armored samurai emerge beyond the gate; enormous shapes move between the trees." },
  { id: "2c", scene: "attack", start: 14, end: 16, kind: "arrow-fire", note: "An arrow strikes a lantern; fire spreads across a rooftop." },
  { id: "2d", scene: "attack", start: 16, end: 18, kind: "gate-breach", note: "A monster crashes through the gate. Villagers scatter. The father pulls his family inside." },

  // 00:18–00:28 THE HIDING PLACE
  { id: "3a", scene: "hiding", start: 18, end: 21, kind: "hatch-open", note: "The father lifts a floor hatch over a small stone cellar; the mother lowers the boy in." },
  { id: "3b", scene: "hiding", start: 21, end: 23.6, kind: "grip-sleeve", note: "The boy grips his mother's sleeve." },
  { id: "3c", scene: "hiding", start: 23.6, end: 26.6, kind: "charm-hand", note: "She places a small wooden charm in his hand and closes his fingers around it." },
  { id: "3d", scene: "hiding", start: 26.6, end: 28, kind: "hatch-close", note: "The hatch closes. Through a narrow gap he sees his parents turn toward the door." },

  // 00:28–00:40 THE MAN HE WILL REMEMBER
  { id: "4a", scene: "remember", start: 28, end: 30, kind: "door-breaks", note: "Through the gap: the door breaks inward." },
  { id: "4b", scene: "remember", start: 30, end: 32, kind: "antagonist-enters", note: "The antagonist enters slowly; his followers stay behind him." },
  { id: "4c", scene: "remember", start: 32, end: 33.4, kind: "emblem-insert", note: "Detail: the emblem on his armor." },
  { id: "4d", scene: "remember", start: 33.4, end: 35, kind: "sword-face", note: "Detail: his sword, then his face." },
  { id: "4e", scene: "remember", start: 35, end: 36.6, kind: "father-falls", note: "The father raises a household blade. A flash of steel. He falls out of view." },
  { id: "4f", scene: "remember", start: 36.6, end: 38.2, kind: "child-fear", note: "The mother rushes forward. The boy tries to call out; fear catches in his throat. A second movement of the sword." },
  { id: "4g", scene: "remember", start: 38.2, end: 40, kind: "hand-falls", note: "Silence. On the child's face; his mother's hand falls into view beside the gap. The antagonist turns to leave." },

  // 00:40–00:49 BURIED BENEATH THE RUINS
  { id: "5a", scene: "buried", start: 40, end: 43, kind: "ceiling-fire", note: "Flames crawl across the ceiling. The boy pushes against the hatch." },
  { id: "5b", scene: "buried", start: 43, end: 44.4, kind: "beam-falls", note: "A burning beam crashes onto the floor above, concealing the entrance. Darkness." },
  { id: "5c", scene: "buried", start: 44.4, end: 49, kind: "cellar-dark", fadeOut: 1, note: "He curls beneath the stone wall clutching the charm; smoke and orange light drift past a vent." },

  // 00:49–00:58 THE SURVIVOR
  { id: "6a", scene: "survivor", start: 49, end: 52, kind: "dawn-emerge", fadeIn: 1.2, note: "Gray dawn. The boy crawls up through the cooled wreckage." },
  { id: "6b", scene: "survivor", start: 52, end: 55, kind: "ruins-search", note: "He searches the silent ruins, calling softly." },
  { id: "6c", scene: "survivor", start: 55, end: 58, kind: "kneel", fadeOut: 0.6, note: "He kneels where his home once stood, the charm in his fist." },

  // 00:58–00:70 THE YEARS BETWEEN
  { id: "7a", scene: "years", start: 58, end: 61, kind: "first-stance", note: "He returns to his father's stance. Swings. Misses. Tries again." },
  { id: "7b", scene: "years", start: 61, end: 62.2, kind: "montage-rain", note: "Rain running down his face." },
  { id: "7c", scene: "years", start: 62.2, end: 63.3, kind: "montage-knocked", note: "A practice sword slips from his hands on impact (autumn)." },
  { id: "7d", scene: "years", start: 63.3, end: 64.4, kind: "montage-wrist", note: "A wrapped wrist tightening around the grip." },
  { id: "7e", scene: "years", start: 64.4, end: 65.5, kind: "montage-snow", note: "Bare feet steadying in snow." },
  { id: "7f", scene: "years", start: 65.5, end: 66.4, kind: "montage-fall", note: "Another fall." },
  { id: "7g", scene: "years", start: 66.4, end: 67.4, kind: "montage-attempt", note: "Another attempt — older now, movement controlled (spring)." },
  { id: "7h", scene: "years", start: 67.4, end: 70, kind: "match-cut", note: "A swing begun by the child finishes in the hands of the adult warrior." },

  // 00:70–00:76 THE HUNT BEGINS
  { id: "8a", scene: "hunt", start: 70, end: 71.3, kind: "tie-charm", note: "The adult secures the wooden charm beneath his armor." },
  { id: "8b", scene: "hunt", start: 71.3, end: 73, kind: "fortress-draw", note: "Across the valley an enemy fortress rises above the clouds. He draws his blade." },
  { id: "8c", scene: "hunt", start: 73, end: 73.3, kind: "black", note: "Cut to black." },
  { id: "8d", scene: "hunt", start: 73.3, end: 74.8, kind: "tagline", note: "On-screen text." },
  { id: "8e", scene: "hunt", start: 74.8, end: 76, kind: "title", note: "Game title (working title)." },
];

export const FILM_DURATION = SHOTS[SHOTS.length - 1].end;

export type CueTrack = "speech" | "sound";

export type Cue = {
  start: number;
  end: number;
  track: CueTrack;
  /** Present for speech cues. */
  speaker?: SpeakerId;
  /** Voice-over is narrated by the adult over the image. */
  voiceOver?: boolean;
  /** Lines are rendered on separate rows. */
  lines: string[];
};

/**
 * Subtitles. Speech cues carry the dialogue and narration; sound cues are
 * closed-caption descriptions shown with subtitles for viewers without audio.
 * No voice recordings exist yet — speech currently plays as subtitles only.
 */
export const CUES: Cue[] = [
  { start: 4.2, end: 6.4, track: "speech", speaker: "father", lines: ["Steady your feet. Try again."] },
  { start: 6.5, end: 9.5, track: "speech", speaker: "adult", voiceOver: true, lines: ["I remember his hands correcting mine.", "Her voice calling us home."] },
  { start: 9.0, end: 10.6, track: "sound", lines: ["[warning bell]"] },
  { start: 16.0, end: 17.6, track: "sound", lines: ["[wood splinters]"] },
  { start: 21.3, end: 22.9, track: "speech", speaker: "child", lines: ["Come with me."] },
  { start: 24.0, end: 26.6, track: "speech", speaker: "mother", lines: ["Keep this safe.", "Stay here until we come."] },
  { start: 28.0, end: 29.4, track: "sound", lines: ["[door breaks]"] },
  { start: 38.4, end: 39.0, track: "sound", lines: ["[silence]"] },
  { start: 39.1, end: 40.0, track: "speech", speaker: "antagonist", lines: ["Burn it."] },
  { start: 44.6, end: 45.9, track: "sound", lines: ["[footsteps fade]"] },
  { start: 46.2, end: 48.8, track: "speech", speaker: "adult", voiceOver: true, lines: ["I waited for them to come back."] },
  { start: 52.6, end: 54.2, track: "speech", speaker: "child", lines: ["Mother?"] },
  { start: 55.2, end: 57.9, track: "speech", speaker: "adult", voiceOver: true, lines: ["When morning came, there was no one left."] },
  { start: 61.4, end: 64.6, track: "speech", speaker: "adult", voiceOver: true, lines: ["I remembered the man who took them."] },
  { start: 64.9, end: 69.8, track: "speech", speaker: "adult", voiceOver: true, lines: ["Every day I trained,", "I imagined standing before him again."] },
  { start: 71.5, end: 72.95, track: "speech", speaker: "adult", lines: ["This time, I'll be ready."] },
];

/** End-card copy. Title is the working title until the final name is chosen. */
export const END_CARD = {
  tagline: "Nine stand between you and revenge.",
  title: "GANRYŪ",
  subtitle: "巌流",
};

/**
 * Provisional antagonist identifiers. The three recognizable details the
 * brief asks for. Final designs are open; change the painter's
 * `drawAntagonist*` routines together with this description.
 */
export const PROVISIONAL_ANTAGONIST_DESIGN = {
  face: "Lacquered black half-mask with bared iron teeth; a pale scar runs vertically through the left eye; one crescent horn on the helmet is broken off.",
  emblem: "A crimson ring enclosing three downward-pointing blades.",
  sword: "An over-long nodachi with a crimson-wrapped grip, a ring-shaped guard echoing the emblem, and a notch near the tip.",
};

/**
 * Timed sound-design events, read by `score.ts`. Ambient beds are chosen per
 * scene; these are one-shot hits. Keep in sync with the image when retiming.
 */
export type SoundEvent = {
  at: number;
  sound: "bell" | "arrow" | "whoosh" | "crash" | "door" | "steel" | "thud" | "beam" | "heartbeat" | "swing" | "knock" | "draw" | "taiko" | "step";
};

export const SOUND_EVENTS: SoundEvent[] = [
  { at: 4.0, sound: "swing" },
  { at: 9.05, sound: "bell" },
  { at: 10.2, sound: "bell" },
  { at: 11.6, sound: "bell" },
  { at: 12.4, sound: "step" },
  { at: 13.2, sound: "step" },
  { at: 14.5, sound: "arrow" },
  { at: 14.85, sound: "whoosh" },
  { at: 16.3, sound: "crash" },
  { at: 19.0, sound: "thud" },
  { at: 27.2, sound: "thud" },
  { at: 28.15, sound: "door" },
  { at: 30.4, sound: "step" },
  { at: 31.3, sound: "step" },
  { at: 33.6, sound: "draw" },
  { at: 35.8, sound: "steel" },
  { at: 37.4, sound: "steel" },
  { at: 43.25, sound: "beam" },
  { at: 45.4, sound: "heartbeat" },
  { at: 46.3, sound: "heartbeat" },
  { at: 47.2, sound: "heartbeat" },
  { at: 59.0, sound: "swing" },
  { at: 60.2, sound: "swing" },
  { at: 62.5, sound: "knock" },
  { at: 65.7, sound: "thud" },
  { at: 66.7, sound: "swing" },
  { at: 68.2, sound: "swing" },
  { at: 72.2, sound: "draw" },
  { at: 74.85, sound: "taiko" },
];
