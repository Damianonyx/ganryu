import type { InputFrame } from "./types";

export type Action = "slash" | "parry" | "leap" | "power" | "fold";

/** When several actions are pressed on the same frame, the first one here wins. */
const PRIORITY: readonly Action[] = ["parry", "power", "slash", "leap", "fold"];

/**
 * Remembers the player's last press for a short window, so a press made while
 * the fighter is still busy (mid-slash, staggered, landing) fires as soon as it
 * can instead of being dropped. A phone tap lasts a single game step, so
 * without this, taps made during a swing simply vanish.
 */
export class InputBuffer {
  action: Action | null = null;
  left = 0;

  /** Record this frame's presses. Returns true when something was pressed. */
  push(inp: Pick<InputFrame, Action>, window: number): boolean {
    for (const a of PRIORITY) {
      if (inp[a]) {
        this.action = a;
        this.left = window;
        return true;
      }
    }
    return false;
  }

  /** Let time pass with nothing pressed. */
  tick(dt: number) {
    if (!this.action) return;
    this.left -= dt;
    if (this.left <= 0) this.clear();
  }

  clear() {
    this.action = null;
    this.left = 0;
  }
}
