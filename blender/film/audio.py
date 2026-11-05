"""
Soundtrack for the opening film: voices, sound effects, and music.

    python blender/film/audio.py      # → artifacts/film/audio/mix.wav

Everything except the voices is synthesized here (numpy), so it has no
licensing questions. Voices use Piper text-to-speech (temporary; replace
with recorded actors). Dialogue text and timing come from
src/cinematic/script.ts; sound-effect timing follows the 3D shots in film.py.

Requires: numpy, scipy, soundfile, piper-tts, ffmpeg, node (to read the script).
Voice models: set PIPER_VOICES to a folder with voice-<name>/<name>.onnx.
"""

from __future__ import annotations

import io
import json
import os
import subprocess
import wave

import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "artifacts", "film", "audio")
VOICES = os.environ.get("PIPER_VOICES", "/tmp/claude-0/voices")
SR = 48000
LEN = 76.0
rng = np.random.default_rng(7)

# speaker → (model, libritts speaker id or None, pitch ratio, length scale, reverb seconds, gain)
CAST = {
    "adult": ("en-us-ryan-high", None, 0.93, 1.08, 0.7, 1.0),
    "father": ("en-us-libritts-high", 423, 1.0, 1.05, 0.35, 0.95),
    "mother": ("en-us-libritts-high", 153, 1.0, 1.08, 0.35, 0.95),
    "child": ("en-us-libritts-high", 315, 1.1, 1.0, 0.3, 0.95),
    "antagonist": ("en-us-libritts-high", 342, 0.8, 1.3, 1.4, 1.1),
}


# ------------------------------------------------------------- utilities


def buf():
    return np.zeros((int(LEN * SR), 2), dtype=np.float32)


def place(dst, x, at, gain=1.0, pan=0.0):
    """Mix mono/stereo x into dst at time `at` (s). pan -1..1."""
    if x.ndim == 1:
        l = np.cos((pan + 1) * np.pi / 4)
        r = np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l * 1.414, x * r * 1.414], axis=1)
    i = int(at * SR)
    if i >= len(dst):
        return
    n = min(len(x), len(dst) - i)
    if i < 0:
        x = x[-i:]
        n = min(len(x), len(dst))
        i = 0
    dst[i : i + n] += x[:n] * gain


def env(n, a=0.002, d=0.3, curve=4.0):
    t = np.arange(n) / SR
    att = np.clip(t / max(a, 1e-4), 0, 1)
    dec = np.exp(-t / max(d, 1e-4) * curve / 4)
    return att * dec


def noise(dur):
    return rng.standard_normal(int(dur * SR)).astype(np.float32)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x).astype(np.float32)


def lp(x, f, order=2):
    sos = signal.butter(order, f, btype="low", fs=SR, output="sos")
    return signal.sosfilt(sos, x).astype(np.float32)


def hp(x, f, order=2):
    sos = signal.butter(order, f, btype="high", fs=SR, output="sos")
    return signal.sosfilt(sos, x).astype(np.float32)


def tone(freq, dur, kind="sine", detune=0.0):
    t = np.arange(int(dur * SR)) / SR
    ph = 2 * np.pi * freq * t * (1 + detune)
    if kind == "sine":
        return np.sin(ph).astype(np.float32)
    if kind == "saw":
        return (2 * ((freq * t) % 1) - 1).astype(np.float32)
    if kind == "tri":
        return (2 * np.abs(2 * ((freq * t) % 1) - 1) - 1).astype(np.float32)
    raise ValueError(kind)


def reverb(x, seconds=1.2, mix=0.25, seed=3):
    """Cheap convolution reverb with an exponentially decaying noise tail."""
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t * 6.9 / seconds)
    ir = lp(ir.astype(np.float32), 6000)
    ir /= np.sqrt((ir**2).sum()) + 1e-9
    if x.ndim == 1:
        wet = signal.fftconvolve(x, ir)[: len(x) + n]
        out = np.zeros(len(wet), dtype=np.float32)
        out[: len(x)] += x * (1 - mix)
        return (out + wet * mix).astype(np.float32)
    return np.stack([reverb(x[:, c], seconds, mix, seed + c) for c in range(2)], axis=1)


# ------------------------------------------------------------- sound kit


def sword_ring(dur=1.6, base=2300.0, bright=1.0):
    """Struck steel: inharmonic partials with fast decay plus a click."""
    n = int(dur * SR)
    out = np.zeros(n, dtype=np.float32)
    for k, (ratio, amp, dec) in enumerate(((1.0, 1.0, 0.5), (1.47, 0.6, 0.35), (2.09, 0.45, 0.25), (2.76, 0.3, 0.18), (3.53, 0.2, 0.12))):
        out += amp * tone(base * ratio, dur, detune=0.0007 * k) * env(n, 0.0005, dec * dur)
    click = hp(noise(0.02), 3000) * np.linspace(1, 0, int(0.02 * SR))
    out[: len(click)] += click * 0.8 * bright
    return out * 0.35


def sword_clink(dur=0.35):
    """The short 'click' of a blade seating or a guard tapping steel."""
    n = int(dur * SR)
    out = hp(noise(dur), 4000) * env(n, 0.0003, 0.015)
    out += 0.5 * tone(4100, dur) * env(n, 0.0003, 0.06) + 0.3 * tone(6230, dur) * env(n, 0.0003, 0.04)
    return out * 0.6


def draw_slide(dur=0.6):
    """Blade sliding from the scabbard: filtered noise sweep plus metallic shimmer."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = noise(dur)
    sweep = np.zeros(n, dtype=np.float32)
    for i, f in enumerate(np.linspace(1800, 5200, 12)):
        seg = slice(int(i * n / 12), int((i + 1) * n / 12))
        sweep[seg] = bp(x, f * 0.8, f * 1.2)[seg]
    shimmer = tone(3200, dur) * 0.15 * (0.5 + 0.5 * np.sin(2 * np.pi * 23 * t))
    e = np.minimum(1, t / 0.05) * np.exp(-np.maximum(0, t - dur * 0.7) * 12)
    return (sweep * 0.5 + shimmer) * e * 0.6


def whoosh(dur=0.32, lo=300, hi=2400, gain=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = noise(dur)
    f = np.linspace(hi, lo, n)
    out = np.zeros(n, dtype=np.float32)
    for i in range(8):
        seg = slice(int(i * n / 8), int((i + 1) * n / 8))
        fc = f[seg].mean()
        out[seg] = bp(x, fc * 0.6, min(SR / 2 - 100, fc * 1.6))[seg]
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    return out * e * gain


def slash(ring=True):
    w = whoosh(0.28, 400, 3800, 0.7)
    if not ring:
        return w
    r = sword_ring(1.4, 2500)
    out = np.zeros(max(len(w), len(r) + int(0.12 * SR)), dtype=np.float32)
    out[: len(w)] += w
    out[int(0.12 * SR) : int(0.12 * SR) + len(r)] += r * 0.8
    return out


def wood_clack(dur=0.25, f=520):
    n = int(dur * SR)
    out = (tone(f, dur) * 0.6 + tone(f * 2.3, dur) * 0.3) * env(n, 0.0005, 0.05)
    out += bp(noise(dur), 800, 3000) * env(n, 0.0003, 0.02) * 0.6
    return out * 0.7


def thud(dur=0.5, f=70, gain=0.9):
    n = int(dur * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * np.cumsum(f * (1 + 1.5 * np.exp(-t * 30))) / SR)
    out = body * env(n, 0.001, 0.18) + lp(noise(dur), 400) * env(n, 0.0005, 0.06) * 0.6
    return (out * gain).astype(np.float32)


def crash(dur=1.4, gain=1.0):
    """Wood breaking: low impact, splinter crackles, debris."""
    n = int(dur * SR)
    out = thud(dur, 55, 1.2)[:n]
    cr = np.zeros(n, dtype=np.float32)
    for _ in range(60):
        i = int(rng.uniform(0, 0.8) * SR)
        g = rng.uniform(0.2, 1) * np.exp(-i / SR * 3)
        k = bp(noise(0.03), 1500, 6000) * np.linspace(1, 0, int(0.03 * SR))
        m = max(0, min(len(k), n - i))
        cr[i : i + m] += k[:m] * g
    out += cr * 0.7 + bp(noise(dur), 300, 1500) * env(n, 0.002, 0.25) * 0.5
    return out * gain


def footstep(kind="dirt", gain=0.5):
    if kind == "armour":
        s = thud(0.25, 60, 0.6)
        j = sword_clink(0.2) * 0.25
        s[: len(j)] += j
        return s * gain
    if kind == "snow":
        return bp(noise(0.25), 400, 3000) * env(int(0.25 * SR), 0.02, 0.1) * gain
    if kind == "wood":
        return (thud(0.2, 120, 0.4)[: int(0.2 * SR)] + bp(noise(0.2), 600, 2500) * env(int(0.2 * SR), 0.001, 0.03) * 0.3) * gain
    return (lp(noise(0.2), 900) * env(int(0.2 * SR), 0.003, 0.06) + thud(0.2, 80, 0.3)[: int(0.2 * SR)]) * gain


def bell(dur=5.0):
    n = int(dur * SR)
    out = np.zeros(n, dtype=np.float32)
    for ratio, amp, dec in ((0.5, 0.5, 4.0), (1.0, 1.0, 3.2), (1.19, 0.5, 2.4), (1.5, 0.35, 1.8), (2.0, 0.3, 1.4), (2.74, 0.2, 0.9), (3.76, 0.1, 0.6)):
        out += amp * tone(196 * ratio, dur, detune=0.0004) * env(n, 0.002, dec)
    th = thud(0.4, 90, 0.6)
    out[: len(th)] += th
    return reverb(out * 0.45, 2.5, 0.35)


def fire_bed(dur, intensity=1.0, seed=1):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    rumble = lp(r.standard_normal(n).astype(np.float32), 180) * 0.6
    roar = bp(r.standard_normal(n).astype(np.float32), 300, 1800) * 0.25
    crack = np.zeros(n, dtype=np.float32)
    count = int(dur * 18 * intensity)
    for _ in range(count):
        i = int(r.uniform(0, max(1, n - 2000)))
        L = int(r.uniform(0.002, 0.012) * SR)
        k = hp(r.standard_normal(L).astype(np.float32), 2000) * np.linspace(1, 0, L) * r.uniform(0.2, 1.0)
        crack[i : i + L] += k
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.4 * np.arange(n) / SR + seed)
    return (rumble + roar * lfo + crack * 0.8) * intensity * 0.55


def wind_bed(dur, gain=0.3, seed=2):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    x = r.standard_normal(n).astype(np.float32)
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * np.arange(n) / SR + seed)
    return bp(x, 200, 900) * lfo * gain


def rain_bed(dur, gain=0.35):
    n = int(dur * SR)
    x = hp(noise(dur), 1500) * 0.4 + bp(noise(dur), 400, 1500) * 0.3
    return x * gain


def crickets(dur, gain=0.08):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n, dtype=np.float32)
    for k, f in enumerate((4200, 4700, 5100)):
        chirp = (np.sin(2 * np.pi * 22 * t + k) > 0.2).astype(np.float32) * (np.sin(2 * np.pi * (0.7 + 0.2 * k) * t + k * 2) > 0.3)
        out += tone(f, dur) * lp(chirp, 120) * 0.5
    return out * gain


def heartbeat():
    a = thud(0.25, 55, 0.9)
    b = thud(0.3, 48, 0.7)
    out = np.zeros(int(0.7 * SR), dtype=np.float32)
    out[: len(a)] += a
    out[int(0.24 * SR) : int(0.24 * SR) + len(b)] += b
    return lp(out, 300)


def roar(dur=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f0 = 85 * (1 + 0.3 * np.sin(np.pi * t / dur)) * (1 + 0.04 * np.sin(2 * np.pi * 9 * t))
    src = signal.sawtooth(2 * np.pi * np.cumsum(f0) / SR).astype(np.float32) + noise(dur) * 0.5
    out = bp(src, 150, 600) * 0.7 + bp(src, 700, 1400) * 0.4
    e = np.minimum(1, t / 0.15) * np.exp(-np.maximum(0, t - dur * 0.6) * 4)
    return out * e * 0.6


def arrow(dur=0.45):
    n = int(dur * SR)
    t = np.arange(n) / SR
    whistle = np.sin(2 * np.pi * np.cumsum(np.linspace(2600, 1700, n)) / SR) * 0.25
    return (whistle + bp(noise(dur), 1500, 5000) * 0.3) * np.sin(np.pi * t / dur)


def creak(dur=0.8, f=180):
    n = int(dur * SR)
    t = np.arange(n) / SR
    pulses = (np.sin(2 * np.pi * (30 + 20 * np.sin(2 * np.pi * 1.5 * t)) * t) > 0.9).astype(np.float32)
    out = bp(pulses + noise(dur) * 0.05, f, f * 6)
    return out * np.sin(np.pi * t / dur) * 0.6


def taiko(gain=1.0):
    d = 1.6
    n = int(d * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * np.cumsum(62 * (1 + 0.6 * np.exp(-t * 18))) / SR) * env(n, 0.001, 0.55)
    skin = bp(noise(d), 200, 1200) * env(n, 0.0005, 0.05) * 0.5
    return reverb((body + skin) * gain, 1.8, 0.3)


def ignite(dur=1.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return lp(noise(dur), 1200) * np.minimum(1, t / 0.08) * np.exp(-t * 2.5) * 0.9


# ------------------------------------------------------------------ music


def koto(freq, dur=2.2, gain=0.3):
    """Karplus–Strong pluck with a bright attack, like a koto string."""
    n = int(dur * SR)
    period = int(SR / freq)
    buf_ = rng.uniform(-1, 1, period).astype(np.float32)
    out = np.zeros(n, dtype=np.float32)
    for i in range(n):
        v = buf_[i % period]
        out[i] = v
        buf_[i % period] = 0.996 * 0.5 * (v + buf_[(i + 1) % period])
    return hp(out, 120) * gain


def flute(freq, dur, gain=0.18):
    """Breathy shakuhachi-like tone with slow vibrato."""
    t = np.arange(int(dur * SR)) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5 * t) * np.minimum(1, t / 0.6)
    ph = 2 * np.pi * freq * np.cumsum(vib) / SR
    body = np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph)
    breath = bp(noise(dur), freq * 1.5, freq * 4) * 0.35
    e = np.minimum(1, t / 0.25) * np.minimum(1, (dur - t) / 0.4).clip(0, 1)
    return ((body + breath) * e * gain).astype(np.float32)


def drone(freqs, dur, gain=0.12, bright=900):
    out = np.zeros(int(dur * SR), dtype=np.float32)
    for f in freqs:
        out += tone(f, dur, "saw", 0.0) + tone(f, dur, "saw", 0.003)
    out = lp(out, bright)
    t = np.arange(len(out)) / SR
    e = np.minimum(1, t / 1.5) * np.minimum(1, (dur - t) / 1.5).clip(0, 1)
    return out * e * gain


# D "in" scale: D Eb G A Bb
IN = [293.66, 311.13, 392.0, 440.0, 466.16, 587.33, 622.25, 783.99]


def music():
    m = buf()
    # Before the fire (0–9): koto phrase over a soft drone
    phrase = [(0.6, 3), (1.3, 2), (2.0, 4), (2.9, 3), (3.6, 5), (4.6, 4), (5.3, 2), (6.2, 3), (7.0, 0), (7.8, 1)]
    for at, k in phrase:
        place(m, koto(IN[k] / 2, 2.6, 0.32), at, pan=-0.2 + 0.1 * k / 4)
    place(m, drone([73.4, 110.0], 9.5, 0.05, 600), 0.0)
    # The attack and the house (9–38): low tension drone, swelling
    place(m, drone([55.0, 58.27, 82.4], 29.5, 0.08, 500), 9.0)
    # Buried (40–49): sub drone under the muffled fire
    place(m, drone([41.2, 61.7], 9.0, 0.06, 250), 40.0)
    # Dawn (49–58): lone flute, sparse
    for at, f, d in ((50.0, IN[2], 2.2), (52.8, IN[1], 1.8), (55.6, IN[0], 2.4)):
        place(m, reverb(flute(f, d, 0.12), 2.0, 0.35), at)
    # The years (58–70): flute theme, taiko pulse building
    theme = [(58.4, 0, 1.2), (59.7, 2, 1.0), (60.8, 3, 1.4), (62.4, 4, 1.0), (63.5, 3, 1.0), (64.6, 2, 1.6), (66.4, 5, 1.0), (67.5, 6, 1.2), (68.8, 5, 1.2)]
    for at, k, d in theme:
        place(m, reverb(flute(IN[k], d, 0.15), 1.6, 0.3), at)
    place(m, drone([73.4, 110.0, 146.8], 15.0, 0.07, 1200), 58.0)
    beat = 61.0
    while beat < 72.9:
        k = (beat - 61.0) / 12.0
        place(m, taiko(0.35 + 0.5 * k), beat)
        beat += 1.2 - 0.6 * k
    # The hunt (70–73): swell, then the cut to black
    place(m, drone([36.7, 55.0, 73.4], 3.2, 0.1, 1500), 70.0)
    # Title
    place(m, taiko(1.2), 74.8)
    place(m, reverb(koto(IN[0] / 2, 3.0, 0.4), 2.5, 0.4), 74.85)
    return m


# ------------------------------------------------------------------- SFX


def sfx():
    s = buf()
    # 1. Evening
    place(s, crickets(9.2), 0.0)
    place(s, wind_bed(9.2, 0.08), 0.0)
    place(s, whoosh(0.3, 300, 1500, 0.4), 3.4 + 10 / 24, pan=-0.2)  # wooden sword swing
    place(s, footstep("dirt", 0.5), 3.4 + 26 / 24)  # stumble
    place(s, footstep("dirt", 0.4), 3.4 + 30 / 24)
    for k in range(8):  # child running to mother
        place(s, footstep("dirt", 0.3), 7.05 + k * 0.21, pan=-0.3)
    # 2. The attack
    place(s, bell(), 9.05, 0.9, pan=0.3)
    place(s, bell(), 10.45, 0.7, pan=0.3)
    place(s, bell(), 11.9, 0.55, pan=0.3)
    for k in range(10):  # marching armour
        place(s, footstep("armour", 0.45), 11.1 + k * 0.29, pan=(k % 2) * 0.3 - 0.15)
    place(s, roar(1.4), 12.6, 0.35, pan=-0.5)
    place(s, arrow(), 14.0, 0.8, pan=0.6)
    place(s, thud(0.3, 200, 0.4), 14.42, pan=0.5)
    place(s, ignite(), 14.45, 0.8, pan=0.5)
    place(s, fire_bed(2.0, 0.8, 3), 14.5, 0.7, pan=0.4)
    place(s, crash(1.6, 1.0), 16.25)
    place(s, roar(1.8), 16.55, 0.8)
    for k in range(10):
        place(s, footstep("dirt", 0.35), 16.3 + k * 0.12, pan=rng.uniform(-0.7, 0.7))
    for k in range(4):
        place(s, footstep("wood", 0.5), 17.25 + k * 0.13)
    place(s, thud(0.5, 90, 0.9), 17.2 + 16 / 24)  # door slams
    # 3. The hiding place (muffled fire and chaos outside)
    place(s, lp(fire_bed(10.0, 0.6, 4), 700), 18.0, 0.6)
    place(s, creak(0.8, 160), 18.25, 0.9)
    place(s, thud(0.3, 110, 0.4), 19.2)
    place(s, thud(0.45, 100, 0.7), 26.6 + 16 / 24)  # hatch closes
    place(s, sword_clink(0.2) * 0.3, 24.05)  # charm in the palm (wood tick)
    # 4. The man he will remember
    place(s, crash(1.6, 1.1), 28.25)
    place(s, fire_bed(10.0, 1.0, 5), 28.2, 0.8)
    for k in range(4):  # Nethrak's slow steps, armour and blade
        at = 30.0 + 0.9 + k * 0.92
        place(s, footstep("armour", 0.55), at)
    place(s, sword_clink(), 32.0, 0.6)  # blade turning in his grip
    place(s, draw_slide(0.5), 33.5, 0.5)
    place(s, sword_ring(2.0, 1900), 33.9, 0.35)
    place(s, sword_clink(), 35.0 + 8 / 24, 0.7)  # father's knife
    place(s, slash(), 35.0 + 13 / 24, 1.0)
    place(s, thud(0.7, 60, 0.9), 35.0 + 30 / 24)  # father falls
    place(s, heartbeat(), 36.7, 0.9)
    place(s, heartbeat(), 37.35, 0.9)
    place(s, slash(), 36.6 + 25 / 24, 0.9)
    place(s, thud(0.6, 70, 0.8), 38.2 + 12 / 24)  # mother falls
    for k in range(3):
        place(s, footstep("armour", 0.4), 39.5 + k * 0.5)
    # 5. Buried
    place(s, fire_bed(3.2, 1.1, 6), 40.0, 0.9)
    for at in (40.8, 41.04, 41.29, 41.79, 42.04):
        place(s, thud(0.25, 140, 0.6), at)
    place(s, crash(2.0, 1.4), 43.0 + 10 / 24)
    place(s, lp(fire_bed(5.0, 0.7, 7), 350), 44.4, 0.6)
    for k in range(6):  # attackers' footsteps fading
        place(s, lp(footstep("armour", 0.4), 600), 44.6 + k * 0.32, 1 - k / 6)
    for k in range(5):
        place(s, heartbeat(), 45.4 + k * 0.85, 0.7 - k * 0.1)
    # 6. The survivor (dawn: wind and silence)
    place(s, wind_bed(9.0, 0.22, 8), 49.0)
    place(s, crash(0.9, 0.25), 49.6)
    for k in range(10):
        place(s, footstep("dirt", 0.22), 52.1 + k * 0.6)
    # 7. The years between
    place(s, wind_bed(3.0, 0.12, 9), 58.0)
    for at in (58.4, 58.75, 60.1, 60.6):
        place(s, whoosh(0.3, 300, 1700, 0.45), at)
    place(s, footstep("dirt", 0.5), 59.2)
    place(s, rain_bed(1.4), 61.0, 1.0)
    place(s, whoosh(0.3, 300, 1700, 0.4), 61.35)
    place(s, wood_clack(), 62.2 + 8 / 24, 1.0)
    place(s, wood_clack(0.2, 340), 63.25, 0.6)
    place(s, creak(0.6, 400), 63.4, 0.5)  # wrap tightening
    place(s, wind_bed(2.2, 0.2, 10), 64.4)
    for k in range(3):
        place(s, footstep("snow", 0.5), 64.6 + k * 0.25)
    place(s, thud(0.4, 80, 0.6), 65.5 + 17 / 24)
    place(s, footstep("snow", 0.6), 65.5 + 18 / 24)
    place(s, whoosh(0.3, 400, 2600, 0.6), 66.7)
    place(s, whoosh(0.3, 300, 1700, 0.5), 67.6)
    place(s, slash(), 68.25, 0.9)  # adult finishes the swing with steel
    # 8. The hunt begins
    place(s, sword_clink(), 70.3, 0.5)  # armour plate seating
    place(s, sword_clink(), 70.9, 0.4)
    place(s, wind_bed(1.8, 0.25, 11), 71.3)
    place(s, sword_clink(), 71.62, 0.9)  # koiguchi click as the blade leaves
    place(s, draw_slide(0.65), 71.66, 0.9)
    place(s, sword_ring(2.4, 2600), 72.3, 0.45)
    place(s, thud(1.0, 40, 0.8), 73.0)  # cut to black
    return s


# ---------------------------------------------------------------- voices


def read_cues():
    js = "import('./src/cinematic/script.ts').then(m=>console.log(JSON.stringify(m.CUES.filter(c=>c.track==='speech'))))"
    r = subprocess.run(["node", "--experimental-strip-types", "-e", js], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(r.stdout.strip().splitlines()[-1])


_voice_cache = {}


def synth(model, sid, text, length):
    from piper import PiperVoice, SynthesisConfig

    v = _voice_cache.get(model)
    if v is None:
        v = PiperVoice.load(f"{VOICES}/voice-{model}/{model}.onnx")
        _voice_cache[model] = v
    b = io.BytesIO()
    with wave.open(b, "wb") as w:
        v.synthesize_wav(text, w, syn_config=SynthesisConfig(speaker_id=sid, length_scale=length))
    b.seek(0)
    x, sr = sf.read(b, dtype="float32")
    if x.ndim > 1:
        x = x.mean(axis=1)
    return signal.resample_poly(x, SR, sr).astype(np.float32)


def pitch(x, ratio):
    """Pitch shift keeping duration (ffmpeg rubberband)."""
    if abs(ratio - 1) < 1e-3:
        return x
    p = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", f"rubberband=pitch={ratio}:formant=preserved", "-f", "f32le", "-"],
        input=x.astype(np.float32).tobytes(),
        capture_output=True,
        check=True,
    )
    return np.frombuffer(p.stdout, dtype=np.float32)


def trim(x, thresh=0.01):
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return x
    return x[max(0, idx[0] - 400) : idx[-1] + 2400]


def voices():
    v = buf()
    speech_env = np.zeros(len(v), dtype=np.float32)
    os.makedirs(os.path.join(OUT, "lines"), exist_ok=True)
    for c in read_cues():
        model, sid, ratio, length, rv, gain = CAST[c["speaker"]]
        text = " ".join(c["lines"])
        window = c["end"] - c["start"]
        L = length
        for _ in range(4):
            x = trim(synth(model, sid, text, L))
            dur = len(x) / SR
            if dur <= window * 0.97 or L <= 0.86:
                break
            L = max(0.86, L * max(0.8, window * 0.95 / dur))
        x = pitch(x, ratio)
        x = hp(x, 90)
        x = x / (np.abs(x).max() + 1e-9) * 0.8
        if c["speaker"] == "antagonist":
            x = np.tanh(x * 1.6) * 0.8
        if c.get("voiceOver"):
            x = lp(x, 9000)
        wet = reverb(x, rv, 0.22 if c["speaker"] != "antagonist" else 0.35)
        sf.write(os.path.join(OUT, "lines", f"{c['start']:05.1f}-{c['speaker']}.wav"), wet, SR)
        at = c["start"] + 0.05
        place(v, wet, at, gain)
        i0 = int(at * SR)
        speech_env[i0 : i0 + len(wet)] = 1.0
        print(f"{c['start']:5.1f}s {c['speaker']:10s} {len(wet) / SR:4.1f}s / {window:.1f}s  L={L:.2f}  {text}")
    return v, speech_env


# ------------------------------------------------------------------- mix


def main():
    os.makedirs(OUT, exist_ok=True)
    m = music()
    s = sfx()
    v, speech = voices()
    # duck music (−9 dB) and effects (−4 dB) under dialogue, smoothly
    k = signal.windows.hann(int(0.6 * SR))
    k /= k.sum()
    duck = np.convolve(speech, k, mode="same")[:, None]
    mix = m * (1 - 0.65 * duck) + s * (1 - 0.35 * duck) + v
    # silence beat before "Burn it." (38.4–39.0): pull everything down
    t = np.arange(len(mix)) / SR
    hush = 1 - 0.85 * np.clip(1 - np.abs(t - 38.7) / 0.35, 0, 1)
    mix *= hush[:, None]
    mix = np.tanh(mix * 0.9) / np.tanh(0.9)
    raw = os.path.join(OUT, "mix-raw.wav")
    sf.write(raw, mix.astype(np.float32), SR, subtype="FLOAT")
    final = os.path.join(OUT, "mix.wav")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", raw, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", str(SR), final], check=True)
    for name, x in (("music", m), ("sfx", s), ("voices", v)):
        sf.write(os.path.join(OUT, f"stem-{name}.wav"), (x * 0.8).astype(np.float32), SR)
    print(final)


if __name__ == "__main__":
    main()
