"""Export in-game combat sounds (public/sfx/*.mp3) from the film's sound kit."""

import os
import subprocess
import sys

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audio as A  # noqa: E402

OUT = os.path.join(A.ROOT, "public", "sfx")


def norm(x, peak=0.9):
    x = x.astype(np.float32)
    return x / (np.abs(x).max() + 1e-9) * peak


def cat(*parts):
    n = max(int(at * A.SR) + len(x) for at, x in parts)
    out = np.zeros(n, dtype=np.float32)
    for at, x in parts:
        i = int(at * A.SR)
        out[i : i + len(x)] += x
    return out


SOUNDS = {
    "slash-1": lambda: A.whoosh(0.26, 450, 3600, 0.9),
    "slash-2": lambda: cat((0, A.whoosh(0.24, 500, 4200, 0.9)), (0.05, A.sword_ring(0.6, 2900) * 0.25)),
    "slash-3": lambda: A.whoosh(0.3, 380, 3000, 0.9),
    "clash": lambda: cat((0, A.sword_clink(0.3)), (0, A.sword_ring(1.1, 2200)), (0.01, A.sword_ring(0.9, 3100) * 0.7)),
    "parry": lambda: cat((0, A.sword_clink(0.3) * 1.2), (0, A.sword_ring(0.8, 3400, 1.4))),
    "hit": lambda: cat((0, A.thud(0.35, 85, 1.0)), (0, A.lp(A.noise(0.12), 2500) * A.env(int(0.12 * A.SR), 0.001, 0.03) * 0.6)),
    "leap": lambda: A.whoosh(0.35, 200, 1400, 0.8),
    "power": lambda: cat((0, A.whoosh(0.5, 150, 2000, 0.8)), (0.12, A.thud(0.8, 50, 0.9)), (0.12, A.sword_ring(1.2, 1800) * 0.3)),
    "fold": lambda: A.reverb(A.drone([55.0, 82.4], 1.2, 0.6, 700), 1.5, 0.4),
    "draw": lambda: cat((0, A.sword_clink()), (0.05, A.draw_slide(0.55)), (0.55, A.sword_ring(1.4, 2600) * 0.4)),
    "step": lambda: A.footstep("dirt", 0.8),
    "win": lambda: cat((0, A.taiko(1.0)), (0.05, A.sword_ring(2.2, 2400) * 0.35)),
    "lose": lambda: A.reverb(cat((0, A.thud(1.0, 45, 1.0)), (0, A.drone([41.2, 43.6], 1.8, 0.5, 400))), 1.8, 0.4),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, make in SOUNDS.items():
        x = norm(make())
        if x.ndim > 1:
            x = x.mean(axis=1)
        wav = os.path.join(OUT, f"{name}.wav")
        sf.write(wav, x, A.SR)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav, "-ac", "1", "-ar", "44100", "-b:a", "80k", os.path.join(OUT, f"{name}.mp3")], check=True)
        os.remove(wav)
        print(name, f"{len(x) / A.SR:.2f}s")


if __name__ == "__main__":
    main()
