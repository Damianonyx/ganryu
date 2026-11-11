// Check which film the intro plays: node scripts/film3d/check-intro.mjs [base=http://127.0.0.1:8080]
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://127.0.0.1:8080";
const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
for (const q of ["?intro=1", "?intro=1&film=painted", "?intro=1&motion=reduced"]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(`${base}/${q}`);
  await p.waitForSelector('[data-testid="intro-film"]', { timeout: 60000 });
  await p.waitForTimeout(6000);
  const r = await p.evaluate(() => {
    const v = document.querySelector('[data-testid="intro-video"]');
    return v ? { mode: "video", t: +v.currentTime.toFixed(1), w: v.videoWidth, h: v.videoHeight, paused: v.paused, err: v.error?.code ?? null } : { mode: "canvas" };
  });
  console.log(q, JSON.stringify(r));
  if (q === "?intro=1") await p.screenshot({ path: "/tmp/claude-0/intro-default.png" });
  await p.close();
}
await b.close();
