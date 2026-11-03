import type { InputFrame } from "./types";

const codes = new Set<string>();
let injected: string[] | null = null;
let joyX = 0;
let joyZ = 0;
let tapSlash = false;
let tapParry = false;
let tapLeap = false;
let tapPower = false;
let tapFold = false;

function held(): Set<string> {
  if (injected) return new Set(injected);
  return codes;
}

export function bindInput() {
  const down = (e: KeyboardEvent) => {
    codes.add(e.code);
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  };
  const up = (e: KeyboardEvent) => {
    codes.delete(e.code);
  };
  const blur = () => codes.clear();
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
    document.removeEventListener("visibilitychange", blur);
  };
}

export function setJoystick(x: number, z: number) {
  joyX = x;
  joyZ = z;
}

export function tap(action: "slash" | "parry" | "leap" | "power" | "fold") {
  if (action === "slash") tapSlash = true;
  if (action === "parry") tapParry = true;
  if (action === "leap") tapLeap = true;
  if (action === "power") tapPower = true;
  if (action === "fold") tapFold = true;
}

export function readInput(): InputFrame {
  const h = held();
  let mx = joyX;
  let mz = joyZ;
  if (h.has("KeyA") || h.has("ArrowLeft")) mx -= 1;
  if (h.has("KeyD") || h.has("ArrowRight")) mx += 1;
  if (h.has("KeyW") || h.has("ArrowUp")) mz -= 1;
  if (h.has("KeyS") || h.has("ArrowDown")) mz += 1;
  const mag = Math.hypot(mx, mz);
  if (mag > 1) {
    mx /= mag;
    mz /= mag;
  }
  const slash = tapSlash || h.has("KeyJ") || h.has("Space");
  const parry = tapParry || h.has("KeyL") || h.has("ShiftLeft") || h.has("ShiftRight");
  const leap = tapLeap || h.has("KeyK") || h.has("KeyC");
  const power = tapPower || h.has("KeyQ") || h.has("KeyE");
  const fold = tapFold || h.has("KeyF") || h.has("KeyR");
  tapSlash = tapParry = tapLeap = tapPower = tapFold = false;
  return { mx, mz, slash, parry, leap, power, fold };
}

export function setInjectedKeys(list: string[] | null) {
  injected = list;
}

export function getInjectedHeld(): Set<string> {
  return held();
}
