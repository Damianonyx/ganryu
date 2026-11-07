import { useEffect, useState } from "react";
import { MOTION_DEFAULTS, motion, resetMotion } from "@/game/motion";
import { cn } from "@/lib/utils";

/**
 * Tuning panel for the combat motion tokens (docs/MOTION.md → "Tuning by
 * feel"). Opened with `?tune=1`. Sliders write straight into the live
 * `motion` object the engine reads every frame, so a change is felt at once.
 */

type Group = keyof typeof MOTION_DEFAULTS;
type Knob = { group: Group; key: string; label: string; min: number; max: number; step: number; unit?: "ms" };

const KNOBS: Knob[] = [
  { group: "input", key: "buffer", label: "Input buffer", min: 0, max: 0.4, step: 0.01, unit: "ms" },
  { group: "hitstop", key: "hit", label: "Hit-stop (hit)", min: 0, max: 0.15, step: 0.005, unit: "ms" },
  { group: "hitstop", key: "kill", label: "Hit-stop (kill)", min: 0, max: 0.25, step: 0.005, unit: "ms" },
  { group: "shake", key: "amount", label: "Shake amount", min: 0, max: 2, step: 0.05 },
  { group: "shake", key: "freq", label: "Shake frequency (Hz)", min: 4, max: 32, step: 1 },
  { group: "camera", key: "follow", label: "Camera follow", min: 1, max: 14, step: 0.1 },
  { group: "camera", key: "look", label: "Look follow", min: 1, max: 24, step: 0.5 },
  { group: "camera", key: "yaw", label: "Camera swing", min: 0.5, max: 8, step: 0.1 },
  { group: "fold", key: "blend", label: "Fold blend", min: 0, max: 0.8, step: 0.01, unit: "ms" },
  { group: "dash", key: "ghosts", label: "Dash afterimages", min: 0, max: 8, step: 1 },
];

const read = (k: Knob) => (motion[k.group] as Record<string, number>)[k.key];
const write = (k: Knob, v: number) => {
  (motion[k.group] as Record<string, number>)[k.key] = v;
};
const show = (k: Knob, v: number) => (k.unit === "ms" ? `${Math.round(v * 1000)} ms` : String(Math.round(v * 100) / 100));

export function MotionTuner() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(true);
  const [, setTick] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setEnabled(new URLSearchParams(window.location.search).get("tune") === "1");
  }, []);
  if (!enabled) return null;

  const rerender = () => setTick((n) => n + 1);
  const changed = KNOBS.filter((k) => read(k) !== (MOTION_DEFAULTS[k.group] as Record<string, number>)[k.key]);

  return (
    <div
      className="pointer-events-auto absolute top-[max(0.5rem,env(safe-area-inset-top))] left-1/2 z-50 w-[min(22rem,calc(100vw-1rem))] -translate-x-1/2 rounded-md border border-line bg-ink/90 font-body text-xs text-paper shadow-lg backdrop-blur"
      data-testid="motion-tuner"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button type="button" className="flex w-full items-center justify-between px-3 py-2 tracking-[0.18em] uppercase" onClick={() => setOpen((o) => !o)}>
        <span>Motion tuning{changed.length ? ` · ${changed.length} changed` : ""}</span>
        <span className="text-mist">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="grid max-h-[55dvh] gap-2 overflow-y-auto px-3 pb-3">
          {KNOBS.map((k) => {
            const v = read(k);
            return (
              <label key={`${k.group}.${k.key}`} className="grid gap-0.5">
                <span className="flex justify-between text-paper-dim">
                  <span>{k.label}</span>
                  <span className={cn("tabular-nums", changed.includes(k) && "text-[#e8a25a]")}>{show(k, v)}</span>
                </span>
                <input
                  type="range"
                  min={k.min}
                  max={k.max}
                  step={k.step}
                  value={v}
                  onChange={(e) => {
                    write(k, Number(e.target.value));
                    rerender();
                  }}
                  className="w-full accent-[#b4232a]"
                />
              </label>
            );
          })}
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded border border-line px-2 py-1.5 tracking-[0.14em] uppercase"
              onClick={() => {
                const values = Object.fromEntries(changed.map((k) => [`${k.group}.${k.key}`, read(k)]));
                const text = JSON.stringify(changed.length ? values : motion, null, 1);
                void navigator.clipboard?.writeText(text).then(
                  () => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  },
                  () => window.prompt("Copy these values:", text),
                );
              }}
            >
              {copied ? "Copied" : "Copy values"}
            </button>
            <button
              type="button"
              className="flex-1 rounded border border-line px-2 py-1.5 tracking-[0.14em] uppercase"
              onClick={() => {
                resetMotion();
                rerender();
              }}
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
