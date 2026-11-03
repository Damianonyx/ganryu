import { useEffect, useRef } from "react";
import { DuelOverlay } from "@/components/duel-overlay";
import { Engine } from "@/sim/engine";
import { useDuel } from "@/sim/store";

export function DuelStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const engine = new Engine();
    engineRef.current = engine;
    engine.mount();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    engine.cam.reduced = reduced;
    useDuel.setState({ reducedMotion: reduced });
    try {
      const muted = localStorage.getItem("ganryu-muted") === "1";
      useDuel.setState({ muted });
      engine.setMuted(muted);
    } catch {
      /* ignore */
    }

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let lastW = 0;
    let lastH = 0;
    let lastDpr = 0;

    const loop = (now: number) => {
      const raw = Math.min(0.1, (now - last) / 1000);
      last = now;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, wrap.clientWidth);
      const h = Math.max(1, wrap.clientHeight);
      if (w !== lastW || h !== lastH || dpr !== lastDpr) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        lastW = w;
        lastH = h;
        lastDpr = dpr;
      }
      try {
        engine.step(raw);
        engine.draw(ctx, w, h);
      } catch (err) {
        console.error("[ganryu]", err);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const down = (e: KeyboardEvent) => {
      const en = engineRef.current;
      if (!en) return;
      const k = e.code;
      if (k === "KeyA" || k === "ArrowLeft") en.input.left = true;
      if (k === "KeyD" || k === "ArrowRight") en.input.right = true;
      if (k === "KeyJ" || k === "Space") en.input.slash = true;
      if (k === "KeyK") en.input.leap = true;
      if (k === "KeyL" || k === "ShiftLeft" || k === "ShiftRight") en.input.parry = true;
      if (k === "KeyM") {
        const next = !useDuel.getState().muted;
        useDuel.getState().setMuted(next);
        en.setMuted(next);
        try {
          localStorage.setItem("ganryu-muted", next ? "1" : "0");
        } catch {
          /* ignore */
        }
      }
      if (["Space", "ArrowLeft", "ArrowRight"].includes(k)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      const en = engineRef.current;
      if (!en) return;
      const k = e.code;
      if (k === "KeyA" || k === "ArrowLeft") en.input.left = false;
      if (k === "KeyD" || k === "ArrowRight") en.input.right = false;
      if (k === "KeyJ" || k === "Space") en.input.slash = false;
      if (k === "KeyK") en.input.leap = false;
      if (k === "KeyL" || k === "ShiftLeft" || k === "ShiftRight") en.input.parry = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      engine.unmount();
      engineRef.current = null;
    };
  }, []);

  const unlock = () => engineRef.current?.unlock();

  const onStart = (mode: "watch" | "duel") => {
    unlock();
    engineRef.current?.resetPositions(mode);
    useDuel.getState().start(mode);
  };

  const toggleMute = () => {
    const next = !useDuel.getState().muted;
    useDuel.getState().setMuted(next);
    engineRef.current?.setMuted(next);
    try {
      localStorage.setItem("ganryu-muted", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const onRematch = () => {
    unlock();
    engineRef.current?.resetPositions("duel");
    useDuel.getState().start("duel");
  };

  const onTitle = () => {
    engineRef.current?.resetPositions("watch");
    useDuel.getState().backToTitle();
  };

  const holdLeft = (v: boolean) => {
    if (engineRef.current) engineRef.current.input.left = v;
  };
  const holdRight = (v: boolean) => {
    if (engineRef.current) engineRef.current.input.right = v;
  };
  const tapSlash = () => {
    const en = engineRef.current;
    if (!en) return;
    en.input.slash = true;
    window.setTimeout(() => {
      if (engineRef.current) engineRef.current.input.slash = false;
    }, 80);
  };
  const tapLeap = () => {
    const en = engineRef.current;
    if (!en) return;
    en.input.leap = true;
    window.setTimeout(() => {
      if (engineRef.current) engineRef.current.input.leap = false;
    }, 80);
  };
  const tapParry = () => {
    const en = engineRef.current;
    if (!en) return;
    en.input.parry = true;
    window.setTimeout(() => {
      if (engineRef.current) engineRef.current.input.parry = false;
    }, 80);
  };

  return (
    <div ref={wrapRef} className="relative h-dvh w-full overflow-hidden bg-ink">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        aria-label="Live samurai duel simulation"
      />
      <DuelOverlay
        onStart={onStart}
        onMute={toggleMute}
        onRematch={onRematch}
        onTitle={onTitle}
        holdLeft={holdLeft}
        holdRight={holdRight}
        tapSlash={tapSlash}
        tapLeap={tapLeap}
        tapParry={tapParry}
      />
    </div>
  );
}
