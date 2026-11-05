/**
 * Pure decision logic for the cinematic/preloader hand-off, kept free of
 * React and the DOM so it can be unit-tested.
 */

export type IntroPhase =
  /** Client has not decided yet (SSR / first paint): opaque cover. */
  | "deciding"
  /** Film is playing (game assets may still be loading behind it). */
  | "film"
  /** Film ended or was skipped, assets still loading: honest loading state. */
  | "loading"
  /** Overlay gone; the title/menu is interactive. */
  | "done";

export type FlowEvent =
  | { type: "decide"; playFilm: boolean; ready: boolean }
  | { type: "film-ended"; ready: boolean }
  | { type: "skip"; ready: boolean }
  /** Player chose Continue while the film still plays (only offered when ready). */
  | { type: "continue"; ready: boolean }
  | { type: "ready" }
  | { type: "replay" };

export function nextPhase(phase: IntroPhase, ev: FlowEvent): IntroPhase {
  switch (ev.type) {
    case "decide":
      if (phase !== "deciding") return phase;
      if (ev.playFilm) return "film";
      return ev.ready ? "done" : "loading";
    case "film-ended":
    case "skip":
      if (phase !== "film") return phase;
      return ev.ready ? "done" : "loading";
    case "continue":
      // Continue is only meaningful once loading is complete; otherwise it
      // behaves like Skip and lands on the loading state.
      if (phase !== "film") return phase;
      return ev.ready ? "done" : "loading";
    case "ready":
      // Loading finishing never interrupts the film: the player may keep watching.
      return phase === "loading" ? "done" : phase;
    case "replay":
      return phase === "done" ? "film" : phase;
  }
}
