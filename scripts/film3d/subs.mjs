// Write the film's subtitles (src/cinematic/script.ts CUES) as an ASS file, styled like the intro's captions.
// node subs.mjs <out.ass> [from] [to]   (times in film seconds; output times are shifted to start at `from`)
import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync("src/cinematic/script.ts", "utf8");
const speakers = Object.fromEntries([...src.matchAll(/^\s+(\w+): "([^"]+)",$/gm)].filter(([, k]) => ["child", "adult", "father", "mother", "antagonist"].includes(k)).map(([, k, v]) => [k, v]));
const cues = [...src.matchAll(/\{ start: ([\d.]+), end: ([\d.]+), track: "(\w+)"(?:, speaker: "(\w+)")?(?:, voiceOver: (true))?, lines: \[(.*?)\] \}/g)].map((m) => ({
  start: +m[1], end: +m[2], track: m[3], speaker: m[4], vo: !!m[5], lines: [...m[6].matchAll(/"([^"]+)"/g)].map((x) => x[1]),
}));
const [out, fromS = "0", toS = "76"] = process.argv.slice(2);
const from = +fromS, to = +toS;
const ts = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = (s % 60).toFixed(2).padStart(5, "0"); return `${h}:${String(m).padStart(2, "0")}:${sec}`; };
let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Speech,DejaVu Serif,46,&H00E8EEF2,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,2.2,1.2,2,120,120,84,1
Style: Name,DejaVu Sans,26,&H00A0B4C0,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,3,0,1,1.6,0.8,2,120,120,84,1
Style: Sound,DejaVu Sans,30,&H00B8C4CC,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,3,0,1,1.6,0.8,2,120,120,84,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
for (const c of cues) {
  if (c.end <= from || c.start >= to) continue;
  const a = ts(Math.max(0, c.start - from)), b = ts(Math.min(to, c.end) - from);
  if (c.track === "sound") { ass += `Dialogue: 0,${a},${b},Sound,,0,0,0,,${c.lines.join("\\N")}\n`; continue; }
  const name = (speakers[c.speaker] ?? c.speaker) + (c.vo ? " · voice-over" : "");
  const body = c.lines.join("\\N");
  const n = c.lines.length;
  ass += `Dialogue: 0,${a},${b},Name,,0,0,${84 + n * 56 + 8},,${name}\n`;
  ass += `Dialogue: 0,${a},${b},Speech,,0,0,0,,${c.vo ? "{\\i1}" : ""}${body}\n`;
}
writeFileSync(out, ass);
console.log(`${cues.length} cues -> ${out}`);
