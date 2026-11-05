import { Link } from "@tanstack/react-router";
import { Volume2, VolumeX, Swords, Users, Eye, LogIn, Film } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Portrait } from "@/components/portrait";
import { WarriorSelect } from "@/components/warrior-select";
import { FINAL_LEVEL, LEVELS } from "@/game/levels";

function chapterOf(level: number) {
  if (level >= FINAL_LEVEL) return "The Reckoning";
  if (level >= 7) return "The Inner Circle";
  if (level >= 4) return "The Pursuit";
  return "The Outer Defenses";
}
import { getChar } from "@/game/roster";
import { useGame } from "@/game/store";
import type { CharId } from "@/game/types";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

type OverlayProps = {
  onCampaign: () => void;
  onWatch: () => void;
  onStartLevel: (n: number) => void;
  onDuel: (foe: CharId) => void;
  onOpenLobby: (kind: "duel" | "coop") => void;
  onEnterLobby: () => void;
  onMute: () => void;
  onRematch: () => void;
  onTitle: () => void;
  onReplayIntro: () => void;
};

export function Overlays(props: OverlayProps) {
  const mode = useGame((s) => s.mode);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
      <TopBar onMute={props.onMute} onTitle={props.onTitle} />
      {mode === "title" && <TitleScreen {...props} />}
      {mode === "select" && <WarriorSelect onBack={props.onTitle} onEnter={() => useGame.getState().setMode("levels")} />}
      {mode === "levels" && <LevelScreen onStart={props.onStartLevel} onBack={() => useGame.getState().setMode("select")} />}
      {mode === "lobby" && <LobbyScreen onBack={props.onTitle} onEnter={props.onEnterLobby} />}
      {mode === "result" && <ResultScreen onRematch={props.onRematch} onTitle={props.onTitle} />}
      {mode === "play" && <PlayHud />}
      <RotateHint />
    </div>
  );
}

function TopBar({ onMute, onTitle }: { onMute: () => void; onTitle: () => void }) {
  const muted = useGame((s) => s.muted);
  const mode = useGame((s) => s.mode);
  const { isPending } = useCurrentUserState();
  return (
    <header className="pointer-events-auto flex items-start justify-between px-4 pt-3 sm:px-7 sm:pt-5">
      <button type="button" onClick={onTitle} className="text-left">
        <p className="font-display text-xl tracking-[0.22em] text-paper">GANRYŪ</p>
        <p className="mt-0.5 font-body text-[0.62rem] tracking-[0.32em] text-mist uppercase">
          {mode === "play" ? "The hunt" : "巌流"}
        </p>
      </button>
      <div className="flex items-center gap-2">
        {mode === "play" && (
          <button
            type="button"
            onClick={onTitle}
            className="h-10 px-3 font-body text-[0.65rem] tracking-[0.18em] text-paper-dim uppercase hover:text-paper"
          >
            Yield
          </button>
        )}
        <button
          type="button"
          aria-label={muted ? "Unmute" : "Mute"}
          onClick={onMute}
          className="grid size-11 place-items-center text-paper-dim hover:text-paper"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        {isPending ? (
          <div className="h-8 w-24 animate-pulse rounded-sm bg-paper/10" />
        ) : (
          <>
            <SignedIn>
              <div className="max-w-40 [&_span]:truncate [&_span]:text-xs [&_span]:tracking-normal">
                <UserButton />
              </div>
            </SignedIn>
            <SignedOut>
              <Link
                to="/login"
                className="inline-flex h-10 items-center gap-2 rounded-sm border border-line px-3 font-body text-[0.65rem] tracking-[0.18em] text-paper uppercase hover:border-line-strong"
              >
                <LogIn className="size-3.5" />
                Sign in
              </Link>
            </SignedOut>
          </>
        )}
      </div>
    </header>
  );
}

function TitleScreen({ onCampaign, onWatch, onOpenLobby, onReplayIntro }: OverlayProps) {
  return (
    <div className="pointer-events-auto mx-auto mt-auto mb-8 flex w-full max-w-lg flex-col items-center px-6 pb-[max(1rem,env(safe-area-inset-bottom))] landscape:mb-6 landscape:flex-row landscape:items-end landscape:justify-between landscape:max-w-5xl">
      <div className="mb-8 text-center landscape:mb-0 landscape:text-left">
        <p className="font-body text-[0.68rem] tracking-[0.42em] text-mist uppercase">Nine stand between you and revenge</p>
        <h1 className="mt-2 font-display text-5xl leading-none tracking-[0.16em] text-paper sm:text-6xl">GANRYŪ</h1>
        <p className="mx-auto mt-4 max-w-sm font-body text-sm leading-relaxed text-paper-dim landscape:mx-0">
          A village burned in a single night. One boy survived to remember the man who did it. Cut through Nethrak’s nine followers — then face the Eternal Nightmare himself.
        </p>
      </div>
      <div className="grid w-full max-w-sm gap-2">
        <Button onClick={onCampaign} className="w-full">
          <Swords className="size-4" /> Campaign
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => onOpenLobby("duel")}>
            Duel
          </Button>
          <Button variant="ghost" onClick={() => onOpenLobby("coop")}>
            <Users className="size-4" /> Co-op
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="text" onClick={onWatch}>
            <Eye className="size-4" /> Watch a duel
          </Button>
          <Button variant="text" onClick={onReplayIntro} data-testid="replay-intro">
            <Film className="size-4" /> Replay intro
          </Button>
        </div>
      </div>
    </div>
  );
}

function LevelScreen({ onStart, onBack }: { onStart: (n: number) => void; onBack: () => void }) {
  const maxLevel = useGame((s) => s.maxLevel);
  const level = useGame((s) => s.level);
  return (
    <div className="pointer-events-auto flex min-h-0 flex-1 flex-col bg-gradient-to-b from-ink/50 via-ink/70 to-ink/90 px-4 pb-4 pt-1 sm:px-7">
      <div className="mb-2 flex items-end justify-between">
        <div>
          <p className="font-body text-[0.62rem] tracking-[0.3em] text-mist uppercase">Ten battles</p>
          <h2 className="font-display text-3xl tracking-[0.12em]">The hunt</h2>
        </div>
        <Button variant="text" size="sm" onClick={onBack}>
          Back
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 overflow-auto sm:grid-cols-3 md:grid-cols-4 landscape:grid-cols-6">
        {LEVELS.map((L) => {
          const locked = L.id > maxLevel;
          const foes = L.enemies.map((id) => getChar(id));
          const selected = L.id === level;
          return (
            <button
              key={L.id}
              type="button"
              disabled={locked}
              onClick={() => {
                useGame.getState().setLevel(L.id);
                onStart(L.id);
              }}
              className={cn(
                "flex flex-col overflow-hidden rounded-md border bg-ink-2/90 text-left backdrop-blur-sm",
                selected ? "border-paper" : "border-line",
                locked ? "opacity-40" : "hover:border-line-strong",
              )}
            >
              <div className="relative h-20 overflow-hidden bg-ink-2 landscape:h-16">
                <div className={cn("flex h-full", foes.length > 1 ? "flex-row" : "")}>
                  {foes.map((f) => (
                    <Portrait key={f.id} src={f.portrait} alt={f.name} />
                  ))}
                </div>
                {L.id === FINAL_LEVEL && (
                  <span className="absolute left-2 top-2 rounded-xs bg-blood px-1.5 py-0.5 font-body text-[0.55rem] tracking-[0.16em] text-paper uppercase">
                    Nethrak
                  </span>
                )}
                {L.enemies.length > 1 && (
                  <span className="absolute right-2 top-2 rounded-xs bg-ink/80 px-1.5 py-0.5 font-body text-[0.55rem] tracking-[0.14em] text-paper uppercase">
                    Two
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="font-body text-[0.58rem] tracking-[0.24em] text-mist uppercase">
                  {chapterOf(L.id)} · {String(L.id).padStart(2, "0")}
                </p>
                <p className="font-display text-lg leading-tight">{L.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-paper-dim">{L.blurb}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlayHud() {
  const hud = useGame((s) => s.hud);
  const level = useGame((s) => s.level);
  const fighterId = useGame((s) => s.fighterId);
  const hero = getChar(fighterId);
  const p = hud.player;
  return (
    <>
      <div className="pointer-events-none mt-0.5 flex items-start justify-between gap-3 px-3 sm:px-8">
        <Meter
          name={hero.name}
          kana={hero.kana}
          hp={p?.hp ?? 0}
          max={p?.maxHp ?? 1}
          src={hero.portrait}
          align="left"
          fold={hud.fold / hud.foldMax}
          power={hud.power / hud.powerMax}
        />
        <div className="hidden text-center sm:block">
          <p className="font-body text-[0.58rem] tracking-[0.28em] text-mist uppercase">Battle {level}</p>
          {hud.combo > 1 && <p className="font-display text-2xl tabular-nums text-paper">{hud.combo} cut</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {hud.enemies.map((e) => {
            const c = getChar(e.charId);
            return (
              <Meter
                key={e.id}
                name={c.name}
                kana={c.kana}
                hp={e.hp}
                max={e.maxHp}
                src={c.portrait}
                align="right"
                unbeatable={c.unbeatable}
              />
            );
          })}
        </div>
      </div>
      {hud.hint && (
        <p className="pointer-events-none mx-auto mt-2 max-w-md px-4 text-center font-body text-xs tracking-[0.08em] text-paper-dim">
          {hud.hint}
        </p>
      )}
      <p className="pointer-events-none mx-auto mt-2 hidden text-center font-body text-[0.58rem] tracking-[0.18em] text-mist uppercase lg:block">
        WASD move · J slash · L parry · K leap · Q art · F fold
      </p>
    </>
  );
}

function Meter({
  name,
  kana,
  hp,
  max,
  src,
  align,
  fold,
  power,
  unbeatable,
}: {
  name: string;
  kana: string;
  hp: number;
  max: number;
  src: string;
  align: "left" | "right";
  fold?: number;
  power?: number;
  unbeatable?: boolean;
}) {
  const pct = Math.max(0, hp / Math.max(1, max));
  return (
    <div className={cn("flex items-center gap-2", align === "right" && "flex-row-reverse")}>
      <div className="size-9 overflow-hidden rounded-xs border border-line sm:size-11">
        <Portrait src={src} alt={name} priority />
      </div>
      <div className={cn("w-32 sm:w-44", align === "right" && "text-right")}>
        <p className="font-body text-[0.55rem] tracking-[0.22em] text-mist uppercase">
          {kana} {unbeatable ? "· uncut" : ""}
        </p>
        <p className="font-display text-sm leading-none">{name}</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper/10">
          <div className={cn("h-full", unbeatable ? "bg-blood" : "bg-paper")} style={{ width: `${pct * 100}%` }} />
        </div>
        {fold != null && (
          <div className="mt-1 flex gap-1">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-paper/10">
              <div className="h-full bg-paper/70" style={{ width: `${fold * 100}%` }} />
            </div>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-paper/10">
              <div className="h-full bg-paper/40" style={{ width: `${(power ?? 0) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultScreen({ onRematch, onTitle }: { onRematch: () => void; onTitle: () => void }) {
  const result = useGame((s) => s.result);
  const level = useGame((s) => s.level);
  const win = result === "win";
  return (
    <div className="pointer-events-auto m-auto w-full max-w-md rounded-lg border border-line bg-ink-2/90 px-6 py-8 text-center">
      <p className="font-body text-[0.62rem] tracking-[0.32em] text-mist uppercase">
        {chapterOf(level)} · {String(level).padStart(2, "0")}
      </p>
      <h2 className="mt-2 font-display text-4xl tracking-[0.12em]">{win ? (level >= FINAL_LEVEL ? "It is finished" : "The cut lands") : "You fall"}</h2>
      <p className="mt-3 text-sm text-paper-dim">
        {win
          ? level >= FINAL_LEVEL
            ? "Nethrak falls. The village is answered."
            : "The road to the next follower is open."
          : "Steady your feet. Try again."}
      </p>
      <div className="mt-6 grid gap-2">
        <Button onClick={onRematch}>{win && level < FINAL_LEVEL ? "Next battle" : "Again"}</Button>
        <Button variant="ghost" onClick={onTitle}>
          Title
        </Button>
      </div>
    </div>
  );
}

function LobbyScreen({ onBack, onEnter }: { onBack: () => void; onEnter: () => void }) {
  const [code, setCode] = useState(() => Math.random().toString(36).slice(2, 6).toUpperCase());
  const [join, setJoin] = useState("");
  const room = useGame((s) => s.room);
  const peers = useGame((s) => s.roomPeers);
  const active = room || code;
  return (
    <div className="pointer-events-auto m-auto w-full max-w-md rounded-lg border border-line bg-ink-2/90 px-6 py-7">
      <p className="font-body text-[0.62rem] tracking-[0.3em] text-mist uppercase">Shared ring</p>
      <h2 className="mt-1 font-display text-3xl">Room {active}</h2>
      <p className="mt-2 text-sm text-paper-dim">
        Two blades, one ring. Share the code. Direct connection — no server between the cuts. {peers} connected.
      </p>
      <div className="mt-5 grid gap-2">
        <Button
          onClick={() => {
            useGame.getState().setRoom(code, peers);
          }}
        >
          Host {code}
        </Button>
        <div className="flex gap-2">
          <Input
            value={join}
            onChange={(e) => setJoin(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="Enter code"
            className="uppercase tracking-[0.2em]"
          />
          <Button
            variant="ghost"
            onClick={() => {
              if (join.trim()) useGame.getState().setRoom(join.trim(), 0);
            }}
          >
            Join
          </Button>
        </div>
        <Button variant="ghost" onClick={onEnter}>
          Enter the ring
        </Button>
        <Button variant="text" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

function RotateHint() {
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(orientation: portrait) and (max-width: 820px)");
    const go = () => setPortrait(q.matches);
    go();
    q.addEventListener("change", go);
    return () => q.removeEventListener("change", go);
  }, []);
  const mode = useGame((s) => s.mode);
  if (!portrait || mode !== "play") return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 mx-auto max-w-sm rounded-sm border border-line bg-ink/80 px-3 py-2 text-center font-body text-[0.68rem] tracking-[0.14em] text-paper-dim uppercase">
      Turn the device — the ring is built for landscape
    </div>
  );
}
