// node scripts/film3d/probe.mjs <shot> <t>
// Print where the actors of a shot are at a time, and whether any joint went NaN.
import { chromium } from "playwright";
const [id, t] = process.argv.slice(2);
const b = await chromium.launch({ args: ["--use-gl=angle", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 320, height: 180 } });
p.on("pageerror", (e) => console.log("PAGEERR", e.message));
await p.goto(`http://127.0.0.1:${process.env.PORT ?? 8081}/film-lab?w=320&h=180`);
await p.waitForFunction(() => !!window.__film, null, { timeout: 180000 });
const out = await p.evaluate(([id, t]) => {
  window.__film.load(id);
  for (let i = 0; i < Math.round(t * 30); i++) window.__film.step(1 / 30, false);
  const st = window.__film.stage;
  return st.actors.map((a) => {
    let nan = 0;
    a.rig.root.traverse((o) => { if (!Number.isFinite(o.quaternion.x + o.position.x + o.position.y)) nan++; });
    const head = a.rig.head.getWorldPosition(new a.rig.root.position.constructor());
    return { pos: a.rig.root.position.toArray().map((v) => +v.toFixed(2)), head: head.toArray().map((v) => +v.toFixed(2)), visible: a.rig.root.visible, nan };
  }).concat([{ cam: st.camera.position.toArray().map((v) => +v.toFixed(2)) }]);
}, [id, Number(t)]);
console.log(JSON.stringify(out));
await b.close();
