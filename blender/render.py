"""
Render cinematic test shots with Blender's `bpy` module.

    python blender/render.py <shot> [--preview] [--samples N] [--out DIR]
    python blender/render.py <shot> --frames 1-72      # animated range

Shots: character, gate, fortress, village. Output defaults to
artifacts/blender/ (git-ignored). See blender/README.md.
"""

from __future__ import annotations

import argparse
import importlib
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "shots"))

import bpy  # noqa: E402

import lib  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("shot")
    ap.add_argument("--preview", action="store_true", help="960x540, few samples")
    ap.add_argument("--samples", type=int, default=None)
    ap.add_argument("--frames", default=None, help="e.g. 1-72")
    ap.add_argument("--frame", type=int, default=None, help="single frame of the animation")
    ap.add_argument("--out", default=os.path.join(HERE, "..", "artifacts", "blender"))
    ap.add_argument("--res", default=None, help="e.g. 1280x720")
    ap.add_argument("--engine", default=None, choices=["cycles", "eevee"])
    args = ap.parse_args()

    mod = importlib.import_module(f"shot_{args.shot}")
    lib.reset_scene()
    t0 = time.time()
    mod.build()
    print(f"[{args.shot}] built in {time.time() - t0:.1f}s")

    res = (960, 540) if args.preview else (1920, 1080)
    if args.res:
        w, h = args.res.lower().split("x")
        res = (int(w), int(h))
    samples = args.samples or (24 if args.preview else getattr(mod, "SAMPLES", 96))
    os.makedirs(args.out, exist_ok=True)
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.cycles.samples = samples
    engine = args.engine or getattr(mod, "ENGINE", "cycles")
    if engine == "eevee":
        lib.use_eevee(samples)

    if args.frames:
        a, b = (int(x) for x in args.frames.split("-"))
        sc.frame_start, sc.frame_end = a, b
        d = os.path.join(args.out, args.shot)
        os.makedirs(d, exist_ok=True)
        for f in range(a, b + 1):
            t = time.time()
            lib.render(os.path.join(d, f"{f:04d}.png"), samples, res, frame=f, engine=engine)
            print(f"[{args.shot}] frame {f} {time.time() - t:.1f}s", flush=True)
    else:
        frame = args.frame or getattr(mod, "STILL_FRAME", 1)
        t = time.time()
        path = os.path.join(args.out, f"{args.shot}{'-preview' if args.preview else ''}.png")
        lib.render(path, samples, res, frame=frame, engine=engine)
        print(f"[{args.shot}] {path} in {time.time() - t:.1f}s")


if __name__ == "__main__":
    main()
