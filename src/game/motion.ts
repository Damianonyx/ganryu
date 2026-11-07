/**
 * GANRYŪ motion tokens: the single source for how the game moves.
 *
 * The language behind these numbers, what never animates, the reduced-motion
 * rules, and the reason for each value are in docs/MOTION.md. The UI half of
 * the system lives as CSS custom properties in src/styles.css (--dur-*,
 * --ease-*); `ui` below mirrors them for code that animates from JavaScript.
 *
 * Times are in seconds. Rates are exponential follow rates per second: the
 * remaining distance shrinks by a factor of e every 1/rate seconds.
 */
export const MOTION_DEFAULTS = {
  ui: {
    fast: 0.12,
    base: 0.24,
    slow: 0.4,
    ease: {
      enter: [0.16, 1, 0.3, 1],
      exit: [0.7, 0, 0.84, 0],
      emphasis: [0.34, 1.56, 0.64, 1],
    },
  },
  input: {
    /** How long a press is remembered while the fighter is busy. */
    buffer: 0.15,
    /** Seconds into a blade slash after which Parry or the next Slash can cut the recovery short. */
    slashCancel: 0.26,
    /** The same for beasts, whose slash has two hits. */
    beastCancel: 0.37,
  },
  hitstop: {
    hit: 0.055,
    kill: 0.1,
    parry: 0.04,
  },
  shake: {
    /** Trauma added per event; the shake is trauma². */
    hit: 0.38,
    kill: 0.7,
    parry: 0.25,
    /** Trauma lost per second. */
    decay: 2.4,
    /** Overall amount. 0 turns shake off. */
    amount: 1,
    /** Noise frequency in Hz. Low enough to read as a jolt, not jitter. */
    freq: 18,
  },
  camera: {
    /** How fast the camera body follows its framing position. */
    follow: 5.5,
    /** How fast the point it looks at follows the fighters. */
    look: 9,
    /** How fast it swings around to stay side-on. */
    yaw: 2.6,
    /** How fast it pulls in or out to fit both fighters. */
    zoom: 2.2,
  },
  fold: {
    /** Time to blend the field of view, fog and exposure in or out of a Fold. */
    blend: 0.24,
  },
  dash: {
    /** Afterimages left along a Shadow Step or a teleport. */
    ghosts: 4,
  },
  pose: {
    /** Blend into an attack, Art, Parry, or leap: short, so actions feel instant. */
    attack: 0.05,
    /** Blend into a hit reaction or defeat: near-instant, it should read as an impact. */
    react: 0.03,
    /** Blend back to stance after an action. */
    settle: 0.14,
    /** Blend between standing and moving (bodies without a gait cycle). */
    locomotion: 0.18,
  },
  gait: {
    /** Stride (one full cycle, both feet) at a walk and at full speed, in meters. */
    strideWalk: 0.8,
    strideRun: 1.55,
    /** Share of the cycle each foot is on the ground, at a walk and at full speed. */
    dutyWalk: 0.62,
    dutyRun: 0.42,
    /** Foot lift at full speed, in meters. */
    lift: 0.2,
    /** Hip dip on landing, in meters, and how long it lasts. */
    landDip: 0.11,
    landTime: 0.24,
  },
};

type Widen<T> = T extends number ? number : T extends readonly number[] ? number[] : { -readonly [K in keyof T]: Widen<T[K]> };
export type MotionTokens = Widen<typeof MOTION_DEFAULTS>;

/** The live values the engine reads. The ?tune=1 panel edits these in place. */
export const motion: MotionTokens = JSON.parse(JSON.stringify(MOTION_DEFAULTS));

/** Restore every live value to its default. */
export function resetMotion() {
  const fresh = JSON.parse(JSON.stringify(MOTION_DEFAULTS)) as MotionTokens;
  for (const key of Object.keys(fresh) as (keyof MotionTokens)[]) Object.assign(motion[key], fresh[key]);
}

/** Exponential follow factor for one frame: lerp by this much toward the target. */
export function follow(rate: number, dt: number) {
  return 1 - Math.exp(-Math.max(0, rate) * dt);
}

let reduceQuery: MediaQueryList | null = null;

/** True when the player asked their system for less motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  reduceQuery ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return reduceQuery.matches;
}
