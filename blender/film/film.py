"""
Opening film: shot table, renderer, and assembler.

    python blender/film/film.py stills              # one frame per shot → contact sheet
    python blender/film/film.py render [--draft] [--shots s01,s02] [--step N]
    python blender/film/film.py assemble [--draft]  # frames + end card + audio → MP4

Timing follows src/cinematic/script.ts (scene boundaries and subtitles).
Output: artifacts/film/ (git-ignored).
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path[:0] = [HERE, os.path.join(HERE, ".."), os.path.join(HERE, "..", "shots")]
OUT = os.path.join(ROOT, "artifacts", "film")
FPS = 24

# (id, builder name, start seconds, fade_in s, fade_out s). Each shot ends where the next begins.
SHOTS = [
    ("s01", "s01_village_wide", 0.0, 1.4, 0),
    ("s02", "s02_practice", 3.4, 0, 0),
    ("s03", "s03_mother_calls", 6.8, 0, 0),
    ("s04a", "s04a_bell", 9.0, 0, 0),
    ("s04b", "s04b_father_turns", 10.2, 0, 0),
    ("s05", "s05_gate_threat", 11.0, 0, 0),
    ("s06", "s06_arrow_fire", 14.0, 0, 0),
    ("s07a", "s07a_gate_breach", 16.0, 0, 0),
    ("s07b", "s07b_family_inside", 17.2, 0, 0),
    ("s08", "s08_hatch_open", 18.0, 0, 0),
    ("s09", "s09_grip_sleeve", 21.0, 0, 0),
    ("s10", "s10_charm_hand", 23.6, 0, 0),
    ("s11", "s11_hatch_close", 26.6, 0, 0),
    ("s12", "s12_door_breaks", 28.0, 0, 0),
    ("s13", "s13_nethrak_enters", 30.0, 0, 0),
    ("s14", "s14_face_and_blade", 33.4, 0, 0),
    ("s15", "s15_father_falls", 35.0, 0, 0),
    ("s16", "s16_child_reacts", 36.6, 0, 0),
    ("s17", "s17_hand_falls", 38.2, 0, 0),
    ("s18", "s18_ceiling_fire", 40.0, 0, 0),
    ("s19", "s19_beam_falls", 43.0, 0, 0.5),
    ("s20", "s20_cellar_dark", 44.4, 0.4, 1.0),
    ("s21", "s21_dawn_emerge", 49.0, 1.2, 0),
    ("s22", "s22_ruins_search", 52.0, 0, 0),
    ("s23", "s23_kneel", 55.0, 0, 0.6),
    ("s24", "s24_first_stance", 58.0, 0.3, 0),
    ("s25a", "s25a_rain", 61.0, 0, 0),
    ("s25b", "s25b_knocked", 62.2, 0, 0),
    ("s25c", "s25c_wrist", 63.3, 0, 0),
    ("s25d", "s25d_snow_feet", 64.4, 0, 0),
    ("s25e", "s25e_fall", 65.5, 0, 0),
    ("s25f", "s25f_attempt", 66.4, 0, 0),
    ("s26a", "s26a_match_child", 67.4, 0, 0),
    ("s26b", "s26b_match_adult", 68.2, 0, 0),
    ("s27", "s27_tie_charm", 70.0, 0, 0),
    ("s28", "s28_fortress_draw", 71.3, 0, 0.25),
]
STORY_END = 73.0  # end card (black, tagline, title) runs 73.0–76.0
FILM_END = 76.0


def shot_frames():
    out = []
    for i, (sid, fn, start, fi, fo) in enumerate(SHOTS):
        end = SHOTS[i + 1][2] if i + 1 < len(SHOTS) else STORY_END
        n = int(round((end - start) * FPS))
        out.append((sid, fn, start, end, n, fi, fo))
    return out


def res_for(draft):
    return (640, 360) if draft else (960, 540)


def build(fn_name):
    import bpy  # noqa: F401

    import lib
    import shots

    lib.reset_scene()
    import cast

    cast._M.clear()
    n = getattr(shots, fn_name)()
    return n


def render_shot(sid, fn, n_expected, draft, step=1, still=False):
    import bpy

    import lib

    t0 = time.time()
    n = build(fn)
    sc = bpy.context.scene
    lib.use_eevee(4 if draft else 8)
    w, h = res_for(draft)
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 1, n_expected
    if n != n_expected:
        print(f"[{sid}] builder animates {n} frames; timeline needs {n_expected}", flush=True)
    d = os.path.join(OUT, "draft" if draft else "final", sid)
    os.makedirs(d, exist_ok=True)
    if still:
        f = max(1, int(n_expected * 0.6))
        lib.render(os.path.join(OUT, "stills", f"{sid}.png"), 4, (w, h), frame=f, engine="eevee")
        print(f"[{sid}] still in {time.time() - t0:.1f}s", flush=True)
        return
    for f in range(1, n_expected + 1, step):
        path = os.path.join(d, f"{f:04d}.png")
        if os.path.exists(path):
            continue
        t = time.time()
        lib.render(path, 4 if draft else 8, (w, h), frame=f, engine="eevee")
        print(f"[{sid}] {f}/{n_expected} {time.time() - t:.1f}s", flush=True)
    print(f"[{sid}] done in {time.time() - t0:.0f}s", flush=True)


def run_each(args, still=False):
    """Render each shot in its own Blender process (clean memory, resumable)."""
    wanted = set(args.shots.split(",")) if args.shots else None
    py = sys.executable
    for sid, fn, start, end, n, fi, fo in shot_frames():
        if wanted and sid not in wanted:
            continue
        cmd = [py, __file__, "_one", sid, fn, str(n), "--step", str(args.step)]
        if args.draft:
            cmd.append("--draft")
        if still:
            cmd.append("--still")
        r = subprocess.run(cmd)
        if r.returncode != 0:
            print(f"[{sid}] FAILED ({r.returncode})", flush=True)


def end_card(draft):
    """Black, tagline, and title frames (73.0–76.0) rendered with Pillow."""
    from PIL import Image, ImageDraw, ImageFont

    w, h = (1280, 720)
    d = os.path.join(OUT, "endcard")
    os.makedirs(d, exist_ok=True)
    fonts = os.path.join(HERE, "fonts")

    def font(name, size):
        for p in (os.path.join(fonts, name), "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"):
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
        return ImageFont.load_default()

    tag_f = font("CormorantGaramond-Medium.ttf", 46)
    title_f = font("CormorantGaramond-SemiBold.ttf", 118)
    jp_f = font("NotoSerifJP-Medium.otf", 32)
    n = int((FILM_END - STORY_END) * FPS)
    for i in range(n):
        t = STORY_END + i / FPS
        im = Image.new("RGB", (w, h), (0, 0, 0))
        dr = ImageDraw.Draw(im)

        def seg(a, b):
            return max(0.0, min(1.0, (t - a) / (b - a)))

        if 73.3 <= t < 74.8:
            a = seg(73.3, 73.75) * (1 - seg(74.45, 74.8))
            _center(dr, "Nine stand between you and revenge.", tag_f, w, h // 2, int(239 * a))
        elif t >= 74.8:
            a = seg(74.8, 75.3)
            c = int(239 * a)
            dr.rectangle((w // 2 - 260, h // 2 + 62, w // 2 + 260, h // 2 + 68), fill=(int(180 * a), int(35 * a), int(42 * a)))
            _center(dr, "GANRYŪ", title_f, w, h // 2 - 20, c, spacing=18)
            _center(dr, "巌流", jp_f, w, h // 2 + 120, int(c * 0.8), spacing=14)
        im.save(os.path.join(d, f"{i + 1:04d}.png"))
    return d, n


def _center(dr, text, font, w, cy, c, spacing=0):
    if spacing:
        widths = [dr.textlength(ch, font=font) for ch in text]
        total = sum(widths) + spacing * (len(text) - 1)
        x = (w - total) / 2
        for ch, cw in zip(text, widths):
            dr.text((x, cy), ch, font=font, fill=(c, c, int(c * 0.96)), anchor="lm")
            x += cw + spacing
    else:
        dr.text((w / 2, cy), text, font=font, fill=(c, c, int(c * 0.96)), anchor="mm")


def assemble(draft, audio_path=None):
    """Encode each shot with its fades, then concatenate with the end card and audio."""
    src = os.path.join(OUT, "draft" if draft else "final")
    seg_dir = os.path.join(OUT, "segments")
    os.makedirs(seg_dir, exist_ok=True)
    lst = []
    for sid, fn, start, end, n, fi, fo in shot_frames():
        frames = os.path.join(src, sid)
        dur = n / FPS
        vf = ["scale=1280:720:flags=lanczos", "format=yuv420p"]
        if fi:
            vf.append(f"fade=t=in:st=0:d={fi}")
        if fo:
            vf.append(f"fade=t=out:st={dur - fo:.3f}:d={fo}")
        out = os.path.join(seg_dir, f"{sid}.mp4")
        have = os.path.isdir(frames) and len(os.listdir(frames)) > 0
        if have:
            inp = ["-framerate", str(FPS), "-i", os.path.join(frames, "%04d.png")]
            # fill gaps (e.g. --step renders) by holding frames
            vf.insert(0, f"fps={FPS}")
            vf.insert(1, f"tpad=stop_mode=clone:stop_duration={dur}")
            vf.append(f"trim=duration={dur}")
        else:
            inp = ["-f", "lavfi", "-i", f"color=c=black:s=1280x720:r={FPS}:d={dur}"]
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *inp, "-vf", ",".join(vf), "-r", str(FPS), "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-an", out], check=True)
        lst.append(out)
    ec_dir, n = end_card(draft)
    ec = os.path.join(seg_dir, "endcard.mp4")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-framerate", str(FPS), "-i", os.path.join(ec_dir, "%04d.png"), "-vf", "format=yuv420p", "-c:v", "libx264", "-crf", "20", ec], check=True)
    lst.append(ec)
    with open(os.path.join(seg_dir, "list.txt"), "w") as f:
        for p in lst:
            f.write(f"file '{p}'\n")
    video = os.path.join(OUT, "opening-video-only.mp4")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", os.path.join(seg_dir, "list.txt"), "-c", "copy", video], check=True)
    final = os.path.join(OUT, f"opening-cinematic{'-draft' if draft else ''}.mp4")
    if audio_path and os.path.exists(audio_path):
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", video, "-i", audio_path, "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", final], check=True)
    else:
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", video, "-c", "copy", "-movflags", "+faststart", final], check=True)
    print(final)
    return final


def contact_sheet():
    from PIL import Image

    d = os.path.join(OUT, "stills")
    files = [os.path.join(d, f"{s[0]}.png") for s in SHOTS if os.path.exists(os.path.join(d, f"{s[0]}.png"))]
    if not files:
        return
    ims = [Image.open(f).resize((384, 216)) for f in files]
    cols = 6
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 388, rows * 220), (20, 20, 20))
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % cols) * 388 + 2, (i // cols) * 220 + 2))
    path = os.path.join(OUT, "stills-sheet.jpg")
    sheet.save(path, quality=85)
    print(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["stills", "render", "assemble", "_one", "timeline"])
    ap.add_argument("rest", nargs="*")
    ap.add_argument("--draft", action="store_true")
    ap.add_argument("--shots", default=None)
    ap.add_argument("--step", type=int, default=1)
    ap.add_argument("--still", action="store_true")
    ap.add_argument("--audio", default=os.path.join(OUT, "audio", "mix.wav"))
    args = ap.parse_args()
    if args.cmd == "_one":
        sid, fn, n = args.rest
        render_shot(sid, fn, int(n), args.draft, args.step, args.still)
    elif args.cmd == "stills":
        run_each(args, still=True)
        contact_sheet()
    elif args.cmd == "render":
        run_each(args)
    elif args.cmd == "assemble":
        assemble(args.draft, args.audio)
    elif args.cmd == "timeline":
        for row in shot_frames():
            print(row)


if __name__ == "__main__":
    main()
