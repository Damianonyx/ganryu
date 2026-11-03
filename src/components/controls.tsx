import { useRef } from "react";
import { setJoystick, tap } from "@/game/input";
import { useGame } from "@/game/store";
import { PLAYABLE, getChar } from "@/game/roster";
import { cn } from "@/lib/utils";

export function ControlDock() {
  const fighterId = useGame((s) => s.fighterId);
  const hud = useGame((s) => s.hud);
  const def = PLAYABLE.find((c) => c.id === fighterId) ?? getChar(fighterId);
  const foldReady = hud.fold <= 0;
  const powerReady = hud.power >= hud.powerMax * 0.98;
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="pointer-events-none absolute bottom-[max(0.6rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] landscape:bottom-[max(0.8rem,env(safe-area-inset-bottom))] landscape:left-[max(1.25rem,env(safe-area-inset-left))]">
        <Stick />
      </div>

      <div className="pointer-events-none absolute bottom-[max(0.6rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] landscape:bottom-[max(0.8rem,env(safe-area-inset-bottom))] landscape:right-[max(1.25rem,env(safe-area-inset-right))]">
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Act label="Parry" sub="L" onPress={() => tap("parry")} />
            <Act label="Slash" sub="J" primary onPress={() => tap("slash")} />
            <Act label="Leap" sub="K" onPress={() => tap("leap")} />
            <Act
              label={def.power.name}
              sub="Q"
              ready={powerReady}
              onPress={() => tap("power")}
            />
          </div>
          <button
            type="button"
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-md border px-4",
              "landscape:h-14",
              foldReady
                ? "border-paper/50 bg-paper text-ink"
                : "border-line bg-ink-2/80 text-paper-dim",
            )}
            onPointerDown={(e) => {
              e.preventDefault();
              tap("fold");
            }}
          >
            <span className="font-display text-lg leading-none">4D</span>
            <span className="font-body text-[0.62rem] tracking-[0.22em] uppercase">Fold</span>
            <span className="font-body text-[0.55rem] tracking-[0.18em] uppercase opacity-70">F</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Act({
  label,
  sub,
  primary,
  ready,
  onPress,
}: {
  label: string;
  sub: string;
  primary?: boolean;
  ready?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-14 min-w-[4.5rem] max-w-[7.5rem] flex-col items-center justify-center rounded-md border px-2",
        "active:scale-[0.97] landscape:h-[4.25rem] landscape:min-w-[5.25rem]",
        primary
          ? "border-paper/45 bg-paper text-ink"
          : ready
            ? "border-paper/35 bg-ink-2/90 text-paper"
            : "border-line bg-ink-2/75 text-paper",
      )}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
    >
      <span className="line-clamp-1 font-body text-[0.62rem] tracking-[0.16em] uppercase">{label}</span>
      <span className="font-body text-[0.55rem] tracking-[0.2em] text-mist uppercase">{sub}</span>
    </button>
  );
}

function Stick() {
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const knob = useRef<HTMLDivElement>(null);
  const R = 52;

  const move = (x: number, y: number) => {
    const o = origin.current;
    if (!o) return;
    let dx = x - o.x;
    let dy = y - o.y;
    const m = Math.hypot(dx, dy);
    if (m > R) {
      dx = (dx / m) * R;
      dy = (dy / m) * R;
    }
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
    setJoystick(dx / R, dy / R);
  };

  return (
    <div
      className="pointer-events-auto relative size-28 rounded-full border border-line bg-ink-2/60 landscape:size-36"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        origin.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        move(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (origin.current?.id === e.pointerId) move(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (origin.current?.id !== e.pointerId) return;
        origin.current = null;
        setJoystick(0, 0);
        if (knob.current) knob.current.style.transform = "translate(0,0)";
      }}
      onPointerCancel={() => {
        origin.current = null;
        setJoystick(0, 0);
        if (knob.current) knob.current.style.transform = "translate(0,0)";
      }}
    >
      <div className="absolute inset-6 rounded-full border border-line/70" />
      <div
        ref={knob}
        className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper/80 landscape:size-14"
      />
    </div>
  );
}
