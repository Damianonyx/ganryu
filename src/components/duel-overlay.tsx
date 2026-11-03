import { Camera, RotateCcw, Volume2, VolumeX, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDuel } from "@/sim/store";

type Props = {
  onStart: (mode: "watch" | "duel") => void;
  onMute: () => void;
  onRematch: () => void;
  onTitle: () => void;
  holdLeft: (v: boolean) => void;
  holdRight: (v: boolean) => void;
  tapSlash: () => void;
  tapLeap: () => void;
  tapParry: () => void;
};

export function DuelOverlay({
  onStart,
  onMute,
  onRematch,
  onTitle,
  holdLeft,
  holdRight,
  tapSlash,
  tapLeap,
  tapParry,
}: Props) {
  const mode = useDuel((s) => s.mode);
  const muted = useDuel((s) => s.muted);
  const hud = useDuel((s) => s.hud);
  const help = useDuel((s) => s.help);
  const renHits = useDuel((s) => s.renHits);
  const kaiHits = useDuel((s) => s.kaiHits);
  const toWin = useDuel((s) => s.toWin);
  const winner = useDuel((s) => s.winner);
  const clashes = useDuel((s) => s.clashes);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
      <header
        className={cn(
          "flex items-start justify-between px-5 pt-5 sm:px-8 sm:pt-7",
          "transition-opacity duration-300",
          mode === "title" ? "opacity-0" : "opacity-100",
        )}
      >
        <div className="pointer-events-auto">
          <p className="font-display text-lg tracking-[0.32em] text-paper">GANRYŪ</p>
          <p className="mt-0.5 font-body text-[0.65rem] tracking-[0.28em] text-mist uppercase">
            {mode === "duel" ? "The beam" : "Live simulation"}
          </p>
        </div>
        <div className="pointer-events-auto flex items-center gap-1">
          <Button variant="text" size="icon" aria-label={muted ? "Unmute" : "Mute"} onClick={onMute}>
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </Button>
          {mode === "watch" && (
            <Button variant="text" size="md" onClick={() => onStart("duel")}>
              Duel
            </Button>
          )}
          {mode !== "title" && (
            <Button variant="text" size="md" onClick={onTitle}>
              Title
            </Button>
          )}
        </div>
      </header>

      {mode === "title" && <TitleCard onStart={onStart} />}
      {mode === "result" && (
        <ResultCard winner={winner} clashes={clashes} onRematch={onRematch} onTitle={onTitle} />
      )}

      {mode === "duel" && hud && (
        <div className="mt-2 flex items-center justify-between gap-6 px-5 sm:px-10">
          <FighterMeter name="REN" sub="蓮" hits={renHits} max={toWin} align="left" />
          <FighterMeter name="KAI" sub="甲斐" hits={kaiHits} max={toWin} align="right" />
        </div>
      )}

      <div className="flex-1" />

      {mode === "watch" && (
        <p className="pointer-events-none mb-8 self-center font-body text-[0.7rem] tracking-[0.22em] text-mist uppercase">
          A scripted duel · press Duel to take the blade
        </p>
      )}

      {mode === "duel" && help && (
        <div className="pointer-events-none mb-3 hidden self-center sm:block">
          <p className="font-body text-[0.7rem] tracking-[0.2em] text-mist uppercase">
            A D move · J slash · K leap · L parry
          </p>
        </div>
      )}

      {mode === "duel" && (
        <div className="pointer-events-auto mb-[max(1.2rem,env(safe-area-inset-bottom))] flex items-end justify-between px-4 sm:hidden">
          <div className="flex gap-2">
            <TouchKey
              label="Left"
              onDown={() => holdLeft(true)}
              onUp={() => holdLeft(false)}
            />
            <TouchKey
              label="Right"
              onDown={() => holdRight(true)}
              onUp={() => holdRight(false)}
            />
          </div>
          <div className="flex gap-2">
            <TouchKey label="Parry" onDown={tapParry} />
            <TouchKey label="Leap" onDown={tapLeap} />
            <TouchKey label="Slash" accent onDown={tapSlash} />
          </div>
        </div>
      )}
    </div>
  );
}

function TitleCard({ onStart }: { onStart: (mode: "watch" | "duel") => void }) {
  return (
    <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center px-6">
      <div className="absolute inset-0 bg-gradient-to-b from-ink/35 via-ink/20 to-ink/55" />
      <div className="relative flex max-w-xl flex-col items-center text-center">
        <p className="font-body text-sm tracking-[0.55em] text-paper-dim">巌流</p>
        <h1 className="mt-3 font-display text-3xl leading-none tracking-[0.22em] text-paper">
          GANRYŪ
        </h1>
        <div className="mt-5 h-px w-16 bg-line-strong" />
        <p className="mt-5 max-w-sm font-body text-sm leading-relaxed text-paper-dim">
          Two swordsmen on a single beam. Water below, weather above. A live ink-wash duel — watch
          the choreography, or take the blade.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => onStart("watch")} className="min-w-44">
            Watch the duel
          </Button>
          <Button variant="ghost" onClick={() => onStart("duel")} className="min-w-44">
            <Swords className="size-3.5" />
            Take the beam
          </Button>
        </div>
        <div className="mt-12 flex w-full max-w-md items-center justify-between text-[0.68rem] tracking-[0.28em] text-mist uppercase">
          <span>Ren · 蓮</span>
          <span className="text-paper-dim">versus</span>
          <span>Kai · 甲斐</span>
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  winner,
  clashes,
  onRematch,
  onTitle,
}: {
  winner: "ren" | "kai" | null;
  clashes: number;
  onRematch: () => void;
  onTitle: () => void;
}) {
  const name = winner === "ren" ? "REN" : "KAI";
  const jp = winner === "ren" ? "蓮" : "甲斐";
  return (
    <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-ink/45 px-6">
      <p className="font-body text-xs tracking-[0.4em] text-mist uppercase">The beam is taken</p>
      <h2 className="mt-3 font-display text-2xl tracking-[0.18em] text-paper">
        {name}
        <span className="ml-3 font-body text-lg text-paper-dim">{jp}</span>
      </h2>
      <p className="mt-3 font-body text-sm text-mist tabular-nums">{clashes} clashes</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={onRematch} className="min-w-40">
          <RotateCcw className="size-3.5" />
          Rematch
        </Button>
        <Button variant="ghost" onClick={onTitle} className="min-w-40">
          <Camera className="size-3.5" />
          Watch
        </Button>
      </div>
    </div>
  );
}

function FighterMeter({
  name,
  sub,
  hits,
  max,
  align,
}: {
  name: string;
  sub: string;
  hits: number;
  max: number;
  align: "left" | "right";
}) {
  const remain = Math.max(0, max - hits);
  return (
    <div className={cn("min-w-0 flex-1", align === "right" && "text-right")}>
      <div
        className={cn(
          "flex items-baseline gap-2",
          align === "right" && "flex-row-reverse",
        )}
      >
        <span className="font-display text-lg tracking-[0.2em] text-paper">{name}</span>
        <span className="font-body text-[0.65rem] tracking-[0.2em] text-mist">{sub}</span>
      </div>
      <div
        className={cn("mt-2 flex gap-1.5", align === "right" && "flex-row-reverse")}
      >
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-8 rounded-full",
              i < remain ? "bg-paper" : "bg-paper/20",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function TouchKey({
  label,
  accent,
  onDown,
  onUp,
}: {
  label: string;
  accent?: boolean;
  onDown: () => void;
  onUp?: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "h-14 min-w-14 rounded-md border px-3 font-body text-[0.62rem] tracking-[0.16em] uppercase",
        accent
          ? "border-paper bg-paper text-ink"
          : "border-line bg-ink/50 text-paper",
      )}
      onPointerDown={(e) => {
        e.preventDefault();
        onDown();
      }}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}
