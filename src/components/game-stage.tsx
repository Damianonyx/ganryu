import { useCallback, useEffect, useRef, useState } from "react";
import { ControlDock } from "@/components/controls";
import { MotionTuner } from "@/components/motion-tuner";
import { IntroController } from "@/components/opening-cinematic";
import { Overlays } from "@/components/overlays";
import { settleTask } from "@/cinematic/readiness";
import { Engine } from "@/game/engine";
import { bindInput } from "@/game/input";
import { FINAL_LEVEL } from "@/game/levels";
import { PLAYABLE, ROSTER } from "@/game/roster";
import { migrateSave } from "@/game/save-migration";
import { useGame } from "@/game/store";
import type { CharId } from "@/game/types";
import { useP2PRoom } from "@/lib/multiplayer";
import { loadProgress, saveProgress } from "@/lib/progress";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const LOCAL_KEY = "ganryu-save-v1";
const LEGACY_KEY = "yonji-save-v1";

export function GameStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const { user, isPending } = useCurrentUserState();
  // While the opening cinematic covers the stage, the engine renders one
  // frame (loading readiness) and then idles instead of drawing unseen frames.
  const coveredRef = useRef(true);
  const [replayToken, setReplayToken] = useState(0);
  const onCoverChange = useCallback((covering: boolean) => {
    coveredRef.current = covering;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const engine = new Engine(canvas);
    engineRef.current = engine;
    const unbind = bindInput();
    try {
      const muted =
        localStorage.getItem("ganryu-muted") === "1" || localStorage.getItem("yonji-muted") === "1";
      useGame.setState({ muted });
      engine.audio.setMuted(muted);
    } catch {
      /* ignore */
    }
    try {
      const raw = localStorage.getItem(LOCAL_KEY) ?? localStorage.getItem(LEGACY_KEY);
      if (raw) {
        const s = JSON.parse(raw) as {
          fighterId: CharId;
          maxLevel: number;
          currentLevel: number;
          wins: number;
          losses: number;
        };
        useGame.getState().applySave(migrateSave(s));
      }
    } catch {
      /* ignore */
    }

    let raf = 0;
    let last = performance.now();
    let frames = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      engine.resize(w, h);
      if (frames < 2 || !coveredRef.current) {
        engine.step(dt);
        frames += 1;
        // The first rendered frame compiles shaders and uploads geometry.
        if (frames === 2) settleTask("engine", true);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      unbind();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isPending) settleTask("session", true);
  }, [isPending]);

  useEffect(() => {
    if (isPending || !user) return;
    void loadProgress()
      .then((s) => {
        const local = useGame.getState();
        useGame.getState().applySave(
          migrateSave({
            fighterId: s.fighterId,
            maxLevel: Math.max(s.maxLevel, local.maxLevel),
            currentLevel: Math.max(s.currentLevel, local.level),
            wins: Math.max(s.wins, local.wins),
            losses: Math.max(s.losses, local.losses),
          }),
        );
      })
      .catch(() => {
        /* unsigned or empty */
      });
  }, [user, isPending]);

  const persist = () => {
    const s = useGame.getState();
    const payload = {
      fighterId: s.fighterId,
      maxLevel: s.maxLevel,
      currentLevel: s.level,
      wins: s.wins,
      losses: s.losses,
    };
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    if (user) {
      void saveProgress({ data: payload }).catch(() => undefined);
    }
  };

  const unlock = () => engineRef.current?.unlock();

  const onCampaign = () => {
    unlock();
    useGame.getState().setMode("select");
  };

  const onWatch = () => {
    unlock();
    engineRef.current?.bootWatch();
    useGame.getState().setMode("title");
  };

  const onStartLevel = (n: number) => {
    unlock();
    const id = useGame.getState().fighterId;
    useGame.setState({ playKind: "campaign" });
    engineRef.current?.startCampaign(id, n);
  };

  // Duel vs AI: the chosen protagonist against one of Nethrak's faction.
  const duelFoeRef = useRef<CharId | null>(null);
  const onDuel = (foe?: CharId) => {
    unlock();
    const foes = ROSTER.filter((c) => !c.playable);
    const pick = foe ?? foes[Math.floor(Math.random() * foes.length)].id;
    duelFoeRef.current = pick;
    const s = useGame.getState();
    const hero = PLAYABLE.some((c) => c.id === s.fighterId) ? s.fighterId : PLAYABLE[0].id;
    useGame.setState({ playKind: "duel" });
    engineRef.current?.startDuel(hero, pick);
  };

  const onOpenLobby = (kind: "duel" | "coop") => {
    unlock();
    useGame.setState({ playKind: kind, mode: "lobby" });
  };

  const onMute = () => {
    const next = !useGame.getState().muted;
    useGame.getState().setMuted(next);
    engineRef.current?.audio.setMuted(next);
    try {
      localStorage.setItem("ganryu-muted", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const onRematch = () => {
    unlock();
    const s = useGame.getState();
    if (s.playKind === "duel") {
      onDuel(duelFoeRef.current ?? undefined);
      return;
    }
    const n = s.result === "win" && s.level < FINAL_LEVEL ? s.level + 1 : s.level;
    useGame.getState().setLevel(n);
    engineRef.current?.startCampaign(s.fighterId, n);
  };

  const onTitle = () => {
    engineRef.current?.bootWatch();
    useGame.getState().backToTitle();
  };

  const mode = useGame((s) => s.mode);
  const result = useGame((s) => s.result);
  const fighterId = useGame((s) => s.fighterId);
  const maxLevel = useGame((s) => s.maxLevel);
  const muted = useGame((s) => s.muted);

  useEffect(() => {
    if (isPending) return;
    persist();
    // persist is latest-store snapshot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fighterId, maxLevel, user, isPending]);

  useEffect(() => {
    if (mode !== "result" || !result) return;
    useGame.getState().recordOutcome(result === "win");
    persist();
    // persist reads latest store after recordOutcome
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, result]);

  return (
    <div ref={wrapRef} className="relative h-dvh w-full overflow-hidden bg-ink" style={{ touchAction: "none" }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <Overlays
        onCampaign={onCampaign}
        onWatch={onWatch}
        onStartLevel={onStartLevel}
        onDuel={onDuel}
        onOpenLobby={onOpenLobby}
        onEnterLobby={() => {
          unlock();
          const s = useGame.getState();
          if (s.playKind === "duel") {
            const foe = PLAYABLE.find((c) => c.id !== s.fighterId)?.id ?? "kurogane";
            engineRef.current?.startDuel(s.fighterId, foe);
          } else {
            engineRef.current?.startCampaign(s.fighterId, s.level);
          }
        }}
        onMute={onMute}
        onRematch={onRematch}
        onTitle={onTitle}
        onReplayIntro={() => {
          unlock();
          setReplayToken((n) => n + 1);
        }}
      />
      {mode === "play" && <ControlDock />}
      {mode === "play" && <MotionTuner />}
      {mode === "lobby" && <LobbyNet />}
      <IntroController
        replayToken={replayToken}
        muted={muted}
        onToggleMute={onMute}
        onCoverChange={onCoverChange}
      />
    </div>
  );
}

function LobbyNet() {
  const room = useGame((s) => s.room);
  const fighterId = useGame((s) => s.fighterId);
  const name = fighterId;
  if (!room) return null;
  return <LobbyNetInner room={room} name={name} />;
}

function LobbyNetInner({ room, name }: { room: string; name: string }) {
  const p2p = useP2PRoom({ room, name });
  useEffect(() => {
    useGame.getState().setRoom(room, p2p.peers.length);
  }, [room, p2p.peers.length]);
  useEffect(() => {
    const unsub = p2p.onMessage((from, data) => {
      const msg = data as { t?: string; from?: string };
      if (msg?.t === "hello") {
        /* peer presence */
        void from;
      }
    });
    if (p2p.joined) p2p.send({ t: "hello", fighter: name });
    return unsub;
  }, [p2p, name]);
  return null;
}
