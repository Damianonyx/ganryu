import { createStore } from "zustand/vanilla";

/**
 * Tracks real loading work behind the cinematic. Each task is settled by the
 * code that performs the work; nothing here completes on a timer.
 *
 * Tasks (registered by `startGameLoading` and GameStage):
 * - fonts:     document.fonts.ready
 * - portraits: decode of every selectable fighter portrait
 * - engine:    the Three.js engine has rendered its first frame
 * - session:   the auth session check has resolved (signed in or out)
 */
export type TaskState = "pending" | "done" | "failed";

export type LoadTask = {
  id: string;
  label: string;
  weight: number;
  /** Critical tasks gate the menu even when the film is not shown. */
  critical: boolean;
  state: TaskState;
  detail?: string;
};

export type LoadState = {
  tasks: Record<string, LoadTask>;
};

export const loadStore = createStore<LoadState>(() => ({ tasks: {} }));

export function registerTask(id: string, label: string, weight = 1, critical = true) {
  const cur = loadStore.getState().tasks[id];
  if (cur) return;
  loadStore.setState((s) => ({ tasks: { ...s.tasks, [id]: { id, label, weight, critical, state: "pending" } } }));
}

export function settleTask(id: string, ok: boolean, detail?: string) {
  const cur = loadStore.getState().tasks[id];
  if (!cur || cur.state !== "pending") return;
  loadStore.setState((s) => ({ tasks: { ...s.tasks, [id]: { ...cur, state: ok ? "done" : "failed", detail } } }));
}

export type LoadSummary = { progress: number; ready: boolean; pendingLabels: string[]; failed: LoadTask[] };

/**
 * `scope: "critical"` ignores prefetch work (portraits) so returning players
 * who skip the film are not held at a loading screen longer than before.
 *
 * A failed task still counts as settled: e.g. a missing portrait falls back
 * to the placeholder art already handled by the menu. `ready` is false while
 * any task is pending or before any task is registered.
 */
export function summarize(state: LoadState, scope: "all" | "critical" = "all"): LoadSummary {
  const list = Object.values(state.tasks).filter((t) => scope === "all" || t.critical);
  const total = list.reduce((a, t) => a + t.weight, 0);
  const settled = list.filter((t) => t.state !== "pending");
  const done = settled.reduce((a, t) => a + t.weight, 0);
  return {
    progress: total > 0 ? done / total : 0,
    ready: list.length > 0 && settled.length === list.length,
    pendingLabels: list.filter((t) => t.state === "pending").map((t) => t.label),
    failed: list.filter((t) => t.state === "failed"),
  };
}

let started = false;

/** Starts browser-side asset loading. Safe to call more than once. */
export function startGameLoading(portraits: string[]) {
  if (started || typeof window === "undefined") return;
  started = true;
  registerTask("fonts", "Typefaces");
  registerTask("portraits", "Fighter art", 2, false);
  // Settled by GameStage: first rendered frame, and the auth session check.
  registerTask("engine", "Arena renderer", 3);
  registerTask("session", "Player profile");

  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts?.ready) fonts.ready.then(() => settleTask("fonts", true), () => settleTask("fonts", false));
  else settleTask("fonts", true, "Font loading API unavailable");

  const unique = [...new Set(portraits)];
  let remaining = unique.length;
  const missing: string[] = [];
  const finishOne = (src: string, ok: boolean) => {
    if (!ok) missing.push(src);
    remaining -= 1;
    if (remaining === 0) settleTask("portraits", missing.length === 0, missing.length ? `Missing: ${missing.join(", ")}` : undefined);
  };
  if (remaining === 0) settleTask("portraits", true);
  for (const src of unique) {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (img.decode) img.decode().then(() => finishOne(src, true), () => finishOne(src, true));
      else finishOne(src, true);
    };
    img.onerror = () => finishOne(src, false);
    img.src = src;
  }
}
