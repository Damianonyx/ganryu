# 3D film tools

Offline rendering for the 3D version of the opening film (`src/film3d`, served at `/film-lab`).

| Script | What it does |
| --- | --- |
| `snap.sh [port]` | Copies the source to `/tmp/claude-0/snap-<port>` and serves it there (default 8081), so a long render is not disturbed by edits and hot reloads in the working tree. |
| `capture.mjs <out> <fps> <w> <h> <spec>...` | Renders shots to `artifacts/film3d/<out>`. With `fps` 0, `shot@t1,t2` writes one still per time; otherwise `shot[:start:end]` writes numbered frames. `PORT` picks the server. |
| `probe.mjs <shot> <t>` | Prints where each actor is at a time, and whether any joint went NaN. |
| `subs.mjs <out.ass> [from] [to]` | Writes the screenplay's subtitles (`src/cinematic/script.ts`) as an ASS file. |
| `assemble-range.sh <frames> <from> <to> <name>` | Joins frames with the film's sound mix for that stretch: a clean copy and one with subtitles burned in. |
| `assemble-film.sh <name> <frames-dir>...` | Joins all the acts, in order, into the whole film with its complete sound mix (clean, and with subtitles). |

Typical draft: `scripts/film3d/snap.sh 8081 && PORT=8081 node scripts/film3d/capture.mjs act3 30 960 540 3a 3b 3c 3d`, then `scripts/film3d/assemble-range.sh artifacts/film3d/act3 18 28 act-3`.
