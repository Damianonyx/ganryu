import { Captions, CaptionsOff, Pause, Play, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { nextPhase, type FlowEvent, type IntroPhase } from "@/cinematic/flow";
import {
  parseIntroOverride,
  readIntroRecord,
  readSubtitlesPref,
  shouldAutoplayIntro,
  writeIntroRecord,
  writeSubtitlesPref,
} from "@/cinematic/intro-state";
import { paintFrame } from "@/cinematic/painter";
import { loadStore, startGameLoading, summarize, type LoadState } from "@/cinematic/readiness";
import { CinematicScore } from "@/cinematic/score";
import { CUES, FILM_DURATION, INTRO_SCRIPT_VERSION, SPEAKERS, type Cue } from "@/cinematic/script";
import { cuesAt } from "@/cinematic/timeline";
import { ROSTER } from "@/game/roster";
import { allSpriteUrls } from "@/game/sprite-rig";
import { cn } from "@/lib/utils";

type Props = {
  /** Incremented by the menu's Replay Intro button. */
  replayToken: number;
  muted: boolean;
  onToggleMute: () => void;
  /** True while the overlay hides the game, so GameStage can idle the engine. */
  onCoverChange: (covering: boolean) => void;
};

const subscribe = (cb: () => void) => loadStore.subscribe(cb);
const getLoad = () => loadStore.getState();
const SERVER_LOAD: LoadState = { tasks: {} };
const getServerLoad = () => SERVER_LOAD;

function useLoad(scope: "all" | "critical") {
  const state = useSyncExternalStore(subscribe, getLoad, getServerLoad);
  return summarize(state, scope);
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).get("motion") === "reduced";
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(forced || !!mq?.matches);
    update();
    mq?.addEventListener?.("change", update);
    return () => mq?.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

/**
 * Opening cinematic + preloader. Owns the hand-off between the film, the
 * loading state, and the existing title/menu (see `cinematic/flow.ts`).
 */
export function IntroController({ replayToken, muted, onToggleMute, onCoverChange }: Props) {
  const [phase, dispatchRaw] = useReducer(nextPhase, "deciding" as IntroPhase);
  const dispatch = dispatchRaw as (ev: FlowEvent) => void;
  const [filmKey, setFilmKey] = useState(0);
  const [replayed, setReplayed] = useState(false);
  const [startAt, setStartAt] = useState(0);
  const all = useLoad("all");
  const critical = useLoad("critical");
  // When the film is not shown, only critical work gates the menu.
  const [filmShown, setFilmShown] = useState(false);
  const load = filmShown ? all : critical;

  useEffect(() => {
    startGameLoading(allSpriteUrls(ROSTER.map((c) => c.id)));
    const override = parseIntroOverride(window.location.search);
    const play = shouldAutoplayIntro(readIntroRecord(), override, INTRO_SCRIPT_VERSION);
    const t = Number(new URLSearchParams(window.location.search).get("t"));
    if (play && Number.isFinite(t) && t > 0) setStartAt(Math.min(t, FILM_DURATION - 0.1));
    setFilmShown(play);
    dispatch({ type: "decide", playFilm: play, ready: summarize(loadStore.getState(), play ? "all" : "critical").ready });
  }, [dispatch]);

  useEffect(() => {
    if (load.ready) dispatch({ type: "ready" });
  }, [load.ready, dispatch]);

  const lastReplay = useRef(replayToken);
  useEffect(() => {
    if (replayToken === lastReplay.current) return;
    lastReplay.current = replayToken;
    setStartAt(0);
    setFilmShown(true);
    setReplayed(true);
    setFilmKey((k) => k + 1);
    dispatch({ type: "replay" });
  }, [replayToken, dispatch]);

  const covering = phase !== "done";
  useEffect(() => onCoverChange(covering), [covering, onCoverChange]);

  // Keep the overlay mounted briefly after "done" for a fade-out.
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (covering) {
      setVisible(true);
      return;
    }
    const id = window.setTimeout(() => setVisible(false), 700);
    return () => window.clearTimeout(id);
  }, [covering]);

  if (!visible && !covering) return null;

  return (
    <div
      data-intro-phase={phase}
      className={cn(
        "absolute inset-0 z-40 bg-black transition-opacity duration-700",
        covering ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      {(phase === "film" || (!covering && filmShown)) && (
        <Film
          key={filmKey}
          startAt={startAt}
          ready={load.ready}
          progress={load.progress}
          muted={muted}
          replay={replayed}
          onToggleMute={onToggleMute}
          active={phase === "film"}
          onEnd={() => {
            writeIntroRecord("completed", INTRO_SCRIPT_VERSION);
            dispatch({ type: "film-ended", ready: summarize(loadStore.getState(), "all").ready });
          }}
          onSkip={() => {
            const ready = summarize(loadStore.getState(), "all").ready;
            writeIntroRecord("skipped", INTRO_SCRIPT_VERSION);
            dispatch({ type: ready ? "continue" : "skip", ready });
          }}
        />
      )}
      {phase === "loading" && <LoadingState progress={load.progress} pending={load.pendingLabels} />}
      {phase === "deciding" && <div className="absolute inset-0 bg-black" aria-hidden />}
    </div>
  );
}

function LoadingState({ progress, pending }: { progress: number; pending: string[] }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 grid place-items-center bg-black px-6 text-center"
      data-testid="intro-loading"
    >
      <div className="w-full max-w-sm">
        <p className="font-display text-3xl tracking-[0.18em] text-paper">GANRYŪ</p>
        <p className="mt-6 font-body text-[0.68rem] tracking-[0.32em] text-mist uppercase">Preparing the arena</p>
        <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-paper/10">
          <div className="h-full bg-blood transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p className="mt-3 min-h-[1.25rem] font-body text-xs text-paper-dim">
          {pending.length ? `Loading: ${pending.join(", ")}` : "Ready"}
        </p>
      </div>
    </div>
  );
}

type FilmProps = {
  startAt: number;
  ready: boolean;
  progress: number;
  muted: boolean;
  replay: boolean;
  active: boolean;
  onToggleMute: () => void;
  onEnd: () => void;
  onSkip: () => void;
};

type AudioUi = "locked" | "running" | "suspended";

function Film({ startAt, ready, progress, muted, replay, active, onToggleMute, onEnd, onSkip }: FilmProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const [subs, setSubs] = useState(true);
  const [paused, setPaused] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("paused") === "1";
  });
  // `?clean=1` hides controls for contact-sheet stills.
  const [clean] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("clean") === "1");
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [time, setTime] = useState(startAt);
  const timeRef = useRef(startAt);
  const scoreRef = useRef<CinematicScore | null>(null);
  const [audioUi, setAudioUi] = useState<AudioUi>("locked");
  const endedRef = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => setSubs(readSubtitlesPref()), []);

  // Sound: create lazily; try to start right away (works after a prior gesture,
  // e.g. Replay Intro), otherwise wait for the first tap/key.
  const tryUnlock = useCallback(() => {
    const s = scoreRef.current;
    if (!s) return;
    s.unlock();
    window.setTimeout(() => setAudioUi(s.state), 60);
  }, []);

  useEffect(() => {
    const s = new CinematicScore();
    scoreRef.current = s;
    s.setMuted(muted);
    if (replay) tryUnlock();
    const onGesture = () => {
      if (s.state !== "running") tryUnlock();
    };
    window.addEventListener("pointerdown", onGesture, true);
    window.addEventListener("keydown", onGesture, true);
    return () => {
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
      s.dispose();
      scoreRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => scoreRef.current?.setMuted(muted), [muted]);
  useEffect(() => scoreRef.current?.setPaused(paused || !active), [paused, active]);

  // Clock + painter loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let shownSecond = -1;
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, root.clientWidth > 900 ? 2 : 1.5);
      const w = Math.max(1, Math.round(root.clientWidth * dpr));
      const h = Math.max(1, Math.round(root.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    const ro = new ResizeObserver(size);
    ro.observe(root);
    size();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const running = activeRef.current && !pausedRef.current && document.visibilityState === "visible";
      if (running) timeRef.current = Math.min(FILM_DURATION, timeRef.current + dt);
      const t = timeRef.current;
      paintFrame(ctx, canvas.width, canvas.height, t, { reduced: reducedRef.current });
      scoreRef.current?.update(t);
      // Re-render React (subtitles, UI) at ~10 Hz, not every frame.
      const tenth = Math.floor(t * 10);
      if (tenth !== shownSecond) {
        shownSecond = tenth;
        setTime(t);
      }
      if (t >= FILM_DURATION && !endedRef.current && activeRef.current) {
        endedRef.current = true;
        onEndRef.current();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      // release the backing store
      canvas.width = 0;
      canvas.height = 0;
    };
  }, []);

  // Stop the loop entirely once the film is no longer active (fading out).
  useEffect(() => {
    if (!active) scoreRef.current?.setPaused(true);
  }, [active]);

  const toggleSubs = useCallback(() => {
    setSubs((v) => {
      writeSubtitlesPref(!v);
      return !v;
    });
  }, []);

  const soundButton = useCallback(() => {
    const s = scoreRef.current;
    if (s && s.state !== "running") {
      tryUnlock();
      if (muted) onToggleMute();
      return;
    }
    onToggleMute();
  }, [muted, onToggleMute, tryUnlock]);

  // Keyboard: Esc skip, Space/K pause, M sound, C subtitles.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("button") && (e.key === " " || e.key === "Enter")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      } else if (e.key === " " || e.key === "k" || e.key === "K") {
        e.preventDefault();
        setPaused((v) => !v);
      } else if (e.key === "m" || e.key === "M") soundButton();
      else if (e.key === "c" || e.key === "C") toggleSubs();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onSkip, soundButton, toggleSubs]);

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  // QA/preview hook (used by scripts/cinematic-preview.mjs).
  useEffect(() => {
    window.__cinematic = {
      seek: (t: number) => {
        timeRef.current = Math.max(0, Math.min(FILM_DURATION, t));
        endedRef.current = timeRef.current >= FILM_DURATION && endedRef.current;
      },
      pause: () => setPaused(true),
      play: () => setPaused(false),
      time: () => timeRef.current,
      duration: FILM_DURATION,
      audio: () => scoreRef.current?.state ?? "locked",
    };
    return () => {
      window.__cinematic = undefined;
    };
  }, []);

  const cues = cuesAt(time, CUES);
  const soundOn = audioUi === "running" && !muted;
  const soundLabel = audioUi !== "running" ? "Tap for sound" : muted ? "Sound off" : "Sound on";

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Opening cinematic"
      data-testid="intro-film"
      className="absolute inset-0 outline-none select-none"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />

      <div
        className={cn(
          "pointer-events-auto absolute top-0 right-0 flex items-center gap-1.5 pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:gap-2",
          clean && "hidden",
        )}
      >
        <FilmButton onClick={soundButton} label={soundLabel} pressed={soundOn} testId="intro-sound" highlight={audioUi !== "running"}>
          {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          <span className="hidden sm:inline landscape:inline">{soundLabel}</span>
        </FilmButton>
        <FilmButton onClick={toggleSubs} label={subs ? "Subtitles on" : "Subtitles off"} pressed={subs} testId="intro-subtitles">
          {subs ? <Captions className="size-4" /> : <CaptionsOff className="size-4" />}
          <span className="hidden sm:inline">CC</span>
        </FilmButton>
        <FilmButton onClick={() => setPaused((v) => !v)} label={paused ? "Play" : "Pause"} testId="intro-pause">
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        </FilmButton>
        <FilmButton onClick={onSkip} label={ready ? "Continue" : "Skip intro"} testId="intro-skip" primary>
          <span>{ready ? "Continue" : "Skip"}</span>
          <SkipForward className="size-4" />
        </FilmButton>
      </div>

      {subs && cues.length > 0 && <Subtitles cues={cues} />}

      <div
        className={cn(
          "pointer-events-none absolute bottom-0 left-0 flex items-center gap-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))]",
          clean && "hidden",
        )}
        aria-live="off"
        data-testid="intro-progress"
      >
        <div className="h-[2px] w-16 overflow-hidden rounded-full bg-paper/15">
          <div className="h-full bg-paper/60 transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <span className="font-body text-[0.6rem] tracking-[0.2em] text-paper/50 uppercase">
          {ready ? "Ready" : `Loading ${Math.round(progress * 100)}%`}
        </span>
      </div>
      {paused && !clean && (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-body text-xs tracking-[0.3em] text-paper/70 uppercase">
          Paused
        </p>
      )}
    </div>
  );
}

function FilmButton({
  children,
  onClick,
  label,
  pressed,
  primary,
  highlight,
  testId,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  pressed?: boolean;
  primary?: boolean;
  highlight?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      data-testid={testId}
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-sm px-3 font-body text-[0.65rem] tracking-[0.18em] uppercase backdrop-blur-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/60",
        primary
          ? "border border-paper/40 bg-black/55 text-paper hover:bg-black/75"
          : "border border-paper/15 bg-black/45 text-paper-dim hover:text-paper",
        highlight && "border-paper/45 text-paper",
      )}
    >
      {children}
    </button>
  );
}

function Subtitles({ cues }: { cues: Cue[] }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1.5 px-4 pb-[max(2.6rem,calc(env(safe-area-inset-bottom)+2.2rem))]"
      aria-live="polite"
      data-testid="intro-captions"
    >
      {cues.map((c) => (
        <div
          key={`${c.start}-${c.lines[0]}`}
          className="max-w-[min(92vw,46rem)] rounded-sm bg-black/72 px-3.5 py-2 text-center shadow-[0_2px_18px_rgba(0,0,0,0.6)] sm:px-5"
        >
          {c.speaker && (
            <p className="mb-0.5 font-body text-[0.58rem] tracking-[0.28em] text-mist uppercase sm:text-[0.62rem]">
              {SPEAKERS[c.speaker]}
              {c.voiceOver ? " · voice-over" : ""}
            </p>
          )}
          {c.lines.map((l) => (
            <p
              key={l}
              className={cn(
                "font-body text-[0.98rem] leading-snug text-paper [text-shadow:0_1px_2px_#000,0_0_8px_#000] sm:text-lg",
                c.voiceOver && "italic",
                c.track === "sound" && "text-[0.8rem] tracking-[0.12em] text-paper-dim sm:text-sm",
              )}
            >
              {l}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

declare global {
  interface Window {
    __cinematic?: {
      seek: (t: number) => void;
      pause: () => void;
      play: () => void;
      time: () => number;
      duration: number;
      audio: () => string;
    };
  }
}
