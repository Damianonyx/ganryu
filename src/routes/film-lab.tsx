import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

/**
 * Film lab: renders the 3D opening film's shots for offline capture.
 * `?w=1920&h=1080` sets the render size. Driven from scripts through
 * `window.__film`: `load(id)` builds a shot, `step(dt)` advances and renders
 * one frame. Not linked from the game.
 */
export const Route = createFileRoute("/film-lab")({ component: FilmLab });

function FilmLab() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const [{ FilmStage }, { SHOTS }] = await Promise.all([import("@/film3d/lab"), import("@/film3d/shots")]);
      if (disposed || !ref.current) return;
      const q = new URLSearchParams(window.location.search);
      const w = Number(q.get("w") ?? 1920);
      const h = Number(q.get("h") ?? 1080);
      const stage = new FilmStage(ref.current, w, h);
      window.__film = {
        shots: SHOTS.map((s) => ({ id: s.id, title: s.title, dur: s.dur })),
        load: (id: string) => {
          const s = SHOTS.find((x) => x.id === id);
          if (!s) throw new Error(`no shot ${id}`);
          stage.load(s);
        },
        step: (dt: number, render = true) => stage.step(dt, render),
        stage,
      };
    })();
    return () => {
      disposed = true;
    };
  }, []);
  return <canvas ref={ref} style={{ display: "block", width: "100vw", height: "100vh", background: "#000" }} />;
}

declare global {
  interface Window {
    __film?: { shots: { id: string; title: string; dur: number }[]; load: (id: string) => void; step: (dt: number, render?: boolean) => void; stage?: unknown };
  }
}
