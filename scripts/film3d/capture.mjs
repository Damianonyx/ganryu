// Capture shots from /film-lab frame by frame.
// node scripts/film3d/capture.mjs <out> <fps> <w> <h> <spec>...
//   fps > 0: spec is shot[:start:end] (seconds; omit for the whole shot) -> numbered jpg frames
//   fps 0:   spec is shot[@t1,t2,...] (default: the midpoint) -> one png per time, skipping ahead without rendering
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const [out, fpsS, wS, hS, ...shots] = process.argv.slice(2);
const fps = Number(fpsS), w = Number(wS), h = Number(hS);
const dir = `artifacts/film3d/${out}`;
mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ args: ["--use-gl=angle", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
p.on("pageerror", (e) => console.log("PAGEERR", e.message));
p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${process.env.PORT ?? 8080}/film-lab?w=${w}&h=${h}`);
await p.waitForFunction(() => !!window.__film, null, { timeout: 180000 });
let frame = Number(process.env.START_FRAME ?? 0);
for (const spec of shots) {
  const t0 = Date.now();
  if (fps === 0) {
    const [id, ts] = spec.split("@");
    await p.evaluate((id) => window.__film.load(id), id);
    const dur = await p.evaluate((id) => window.__film.shots.find((s) => s.id === id).dur, id);
    const times = ts ? ts.split(",").map(Number) : [dur / 2];
    const dt = 1 / 30;
    let at = 0;
    for (const t of times) {
      const n = Math.max(0, Math.round((t - at) / dt));
      await p.evaluate(([n, dt]) => { for (let i = 0; i < n - 1; i++) window.__film.step(dt, false); window.__film.step(dt, true); }, [n, dt]);
      at += n * dt;
      await p.screenshot({ path: `${dir}/${id}_${t.toFixed(2)}.png`, timeout: 300000 });
    }
  } else {
    const [id, s0, s1] = spec.split(":");
    await p.evaluate((id) => window.__film.load(id), id);
    const dur = await p.evaluate((id) => window.__film.shots.find((s) => s.id === id).dur, id);
    const start = s0 ? Number(s0) : 0, end = s1 ? Number(s1) : dur;
    const dt = 1 / fps;
    if (start > 0) await p.evaluate(([n, dt]) => { for (let i = 0; i < n; i++) window.__film.step(dt, false); }, [Math.round(start / dt), dt]);
    const n = Math.round((end - start) / dt);
    for (let i = 0; i < n; i++) {
      await p.evaluate((dt) => window.__film.step(dt), dt);
      await p.screenshot({ path: `${dir}/${String(frame++).padStart(5, "0")}.jpg`, type: "jpeg", quality: 95, timeout: 300000 });
    }
  }
  console.log(spec, "done in", ((Date.now() - t0) / 1000).toFixed(1), "s");
}
await b.close();
