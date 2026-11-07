import { useRef, type ReactNode } from "react";
import { setHeld, setJoystick, tap } from "@/game/input";
import { getChar } from "@/game/roster";
import { useGame } from "@/game/store";
import { cn } from "@/lib/utils";

/**
 * Touch controls: a dark joystick with a crimson knob and Art meter on the
 * left, a four-button "diamond" on the right (Slash, Parry, Leap, Art) with
 * cooldown rings, and Fold above it. Sizes scale with the viewport and
 * respect safe areas. Shown on touch devices; desktop uses the keyboard.
 */

type Action = "slash" | "parry" | "leap" | "power" | "fold";

const press = (a: Action) => {
  tap(a);
  setHeld(a, true);
  try {
    navigator.vibrate?.(8);
  } catch {
    /* unsupported */
  }
};

export function ControlDock() {
  const fighterId = useGame((s) => s.fighterId);
  const hud = useGame((s) => s.hud);
  const def = getChar(fighterId);
  const powerK = Math.min(1, hud.powerMax > 0 ? hud.power / hud.powerMax : 0);
  const foldK = hud.fold > 0 ? 1 - Math.min(1, hud.fold / hud.foldMax) : 1;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 [--pad:clamp(3.3rem,12.5vmin,4.7rem)]" data-testid="touch-controls">
      {/* keyboard legend for mouse/keyboard players */}
      <p className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 font-body text-[0.6rem] tracking-[0.22em] text-mist uppercase [@media(pointer:fine)]:block">
        WASD move · J slash · L parry · K leap · Q art · F fold
      </p>

      <div className="absolute bottom-[max(0.9rem,env(safe-area-inset-bottom))] left-[max(0.9rem,env(safe-area-inset-left))] [@media(pointer:fine)]:hidden">
        <Stick meter={powerK} />
      </div>

      <div className="absolute bottom-[max(0.9rem,env(safe-area-inset-bottom))] right-[max(0.9rem,env(safe-area-inset-right))] [@media(pointer:fine)]:hidden">
        <div className="relative" style={{ width: "calc(var(--pad) * 3.05)", height: "calc(var(--pad) * 3.05)" }}>
          <Face className="left-1/2 top-0 -translate-x-1/2" label="Leap" action="leap" testId="btn-leap">
            <IconLeap />
          </Face>
          <Face className="left-0 top-1/2 -translate-y-1/2" label="Parry" action="parry" testId="btn-parry">
            <IconShield />
          </Face>
          <Face className="right-0 top-1/2 -translate-y-1/2" label="Art" ring={powerK} ready={powerK >= 0.98} action="power" testId="btn-art" title={def.power.name}>
            <IconArt />
          </Face>
          <Face className="bottom-0 left-1/2 -translate-x-1/2" label="Slash" primary action="slash" testId="btn-slash">
            <IconSword />
          </Face>
        </div>
        <div className="absolute" style={{ left: "calc(var(--pad) * -0.55)", top: "calc(var(--pad) * -0.55)" }}>
          <Face small label="Fold" ring={foldK} ready={foldK >= 0.98} cyan action="fold" testId="btn-fold">
            <IconHourglass />
          </Face>
        </div>
      </div>
    </div>
  );
}

function Face({
  children,
  label,
  action,
  primary,
  small,
  ring,
  ready,
  cyan,
  className,
  testId,
  title,
}: {
  children: ReactNode;
  label: string;
  action: Action;
  primary?: boolean;
  small?: boolean;
  ring?: number;
  ready?: boolean;
  cyan?: boolean;
  className?: string;
  testId: string;
  title?: string;
}) {
  const size = primary ? "calc(var(--pad) * 1.18)" : small ? "calc(var(--pad) * 0.8)" : "var(--pad)";
  const ringColor = ready ? (cyan ? "#46d6e0" : "#46d6e0") : "#c42a32";
  return (
    <div className={cn("pointer-events-auto absolute flex flex-col items-center", className)}>
      <button
        type="button"
        aria-label={title ? `${label}: ${title}` : label}
        data-testid={testId}
        onPointerDown={(e) => {
          e.preventDefault();
          // The press comes first: nothing below may stop it from registering.
          press(action);
          e.currentTarget.dataset.pressed = "";
          capture(e.currentTarget, e.pointerId);
        }}
        onPointerUp={(e) => release(e.currentTarget, action)}
        onPointerCancel={(e) => release(e.currentTarget, action)}
        onLostPointerCapture={(e) => release(e.currentTarget, action)}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          // Press in instantly; spring back out with a slight overshoot (docs/MOTION.md).
          "relative grid place-items-center rounded-full select-none",
          "transition-[transform,filter] duration-(--dur-fast) ease-(--ease-emphasis)",
          "data-[pressed]:scale-[0.9] data-[pressed]:brightness-125 data-[pressed]:duration-0",
          "shadow-[0_4px_14px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]",
          primary
            ? "bg-[radial-gradient(circle_at_35%_30%,#3a1216,#16090b_70%)] text-[#ffd7d0]"
            : "bg-[radial-gradient(circle_at_35%_30%,#2b2a30,#121115_72%)] text-paper",
        )}
        style={{ width: size, height: size, touchAction: "none" }}
      >
        {/* outer bezel */}
        <span className={cn("absolute inset-0 rounded-full border", primary ? "border-[#c42a32]/80" : "border-paper/15")} />
        {ring !== undefined && (
          <span
            className="absolute -inset-[3px] rounded-full"
            style={{
              background: `conic-gradient(${ringColor} ${Math.round(ring * 360)}deg, rgba(255,255,255,0.07) 0deg)`,
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))",
              filter: ready ? `drop-shadow(0 0 6px ${ringColor})` : undefined,
            }}
          />
        )}
        <span className="relative size-[46%]">{children}</span>
      </button>
      <span className="mt-0.5 font-body text-[0.52rem] tracking-[0.2em] text-paper/70 uppercase [text-shadow:0_1px_2px_#000]">{label}</span>
    </div>
  );
}

/** Keep receiving this finger's events even if it slides off the control. */
function capture(el: HTMLElement, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* the pointer is already gone; pointerup will still release */
  }
}

function release(el: HTMLElement, action: Action) {
  delete el.dataset.pressed;
  setHeld(action, false);
}

function Stick({ meter }: { meter: number }) {
  const origin = useRef<{ x: number; y: number; id: number; r: number } | null>(null);
  const knob = useRef<HTMLDivElement>(null);

  const move = (x: number, y: number) => {
    const o = origin.current;
    if (!o) return;
    let dx = x - o.x;
    let dy = y - o.y;
    const m = Math.hypot(dx, dy);
    if (m > o.r) {
      dx = (dx / m) * o.r;
      dy = (dy / m) * o.r;
    }
    if (knob.current) knob.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    setJoystick(dx / o.r, dy / o.r);
  };
  const release = () => {
    origin.current = null;
    setJoystick(0, 0);
    if (knob.current) {
      // The knob follows the finger exactly while held, and springs home on release.
      knob.current.style.transition = "transform var(--dur-base) var(--ease-emphasis)";
      knob.current.style.transform = "translate(-50%, -50%)";
    }
  };

  // Art meter: a 120° arc hugging the upper-right of the stick
  const arcLen = 2 * Math.PI * 47 * (120 / 360);
  return (
    <div
      className="pointer-events-auto relative"
      data-testid="joystick"
      style={{ width: "calc(var(--pad) * 2.55)", height: "calc(var(--pad) * 2.55)", touchAction: "none" }}
      onPointerDown={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        capture(el, e.pointerId);
        const rect = el.getBoundingClientRect();
        origin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, id: e.pointerId, r: rect.width * 0.32 };
        if (knob.current) knob.current.style.transition = "none";
        move(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (origin.current?.id === e.pointerId) move(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (origin.current?.id === e.pointerId) release();
      }}
      onPointerCancel={release}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          <radialGradient id="stickBase" cx="45%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#2a292e" />
            <stop offset="100%" stopColor="#0f0e11" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="42" fill="url(#stickBase)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        {[0, 90, 180, 270].map((a) => (
          <path key={a} d="M50 15 l-3 4 h6 z" fill="rgba(239,236,228,0.35)" transform={`rotate(${a} 50 50)`} />
        ))}
        {/* meter track and fill */}
        <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(120,20,24,0.35)" strokeWidth="5" strokeDasharray={`${arcLen} 999`} transform="rotate(-80 50 50)" strokeLinecap="round" />
        <circle
          cx="50"
          cy="50"
          r="47"
          fill="none"
          stroke={meter >= 0.98 ? "#ff3b44" : "#b4232a"}
          strokeWidth="5"
          strokeDasharray={`${arcLen * meter} 999`}
          transform="rotate(-80 50 50)"
          strokeLinecap="round"
          style={meter >= 0.98 ? { filter: "drop-shadow(0 0 3px #ff3b44)" } : undefined}
        />
      </svg>
      <div
        ref={knob}
        className="absolute left-1/2 top-1/2 rounded-full shadow-[0_6px_14px_rgba(0,0,0,0.6),inset_0_-4px_8px_rgba(0,0,0,0.45),inset_0_3px_6px_rgba(255,255,255,0.25)]"
        style={{
          width: "calc(var(--pad) * 0.95)",
          height: "calc(var(--pad) * 0.95)",
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle at 38% 32%, #ff7a8a, #d1284a 45%, #6e0f22 100%)",
        }}
      />
    </div>
  );
}

const svgProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: "size-full" };

function IconSword() {
  return (
    <svg {...svgProps} aria-hidden>
      <path d="M19.5 3.5 9 14l1.5 1.5L21 5V3.5z" fill="currentColor" fillOpacity="0.15" />
      <path d="M7 13.5l3.5 3.5M5.5 18.5l2-2M4 20l1.5-1.5M8 16l-2.5 2.5" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg {...svgProps} aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" fill="currentColor" fillOpacity="0.12" />
    </svg>
  );
}
function IconLeap() {
  return (
    <svg {...svgProps} aria-hidden>
      <path d="M6 13l6-6 6 6M6 19l6-6 6 6" />
    </svg>
  );
}
function IconArt() {
  return (
    <svg {...svgProps} aria-hidden>
      <path d="M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.6.8-2.8 1.8-3.6C10 9.5 11 10 11.5 11 12.5 8.5 11.5 5.5 12 3z" fill="currentColor" fillOpacity="0.15" />
      <path d="M8 19h8" />
    </svg>
  );
}
function IconHourglass() {
  return (
    <svg {...svgProps} aria-hidden>
      <path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" />
    </svg>
  );
}
