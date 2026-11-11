#!/usr/bin/env node
/**
 * Opening cinematic preview and verification.
 *
 *   npm run dev                                   # in another terminal
 *   node scripts/cinematic-preview.mjs contact    # one still per shot + contact sheet
 *   node scripts/cinematic-preview.mjs verify     # flow/audio/layout checks
 *   node scripts/cinematic-preview.mjs video      # real-time recording (no audio)
 *
 * Output goes to artifacts/cinematic-preview/ (git-ignored).
 * Set PREVIEW_URL to target another server (default http://127.0.0.1:8080).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.PREVIEW_URL ?? "http://127.0.0.1:8080";
const OUT = path.resolve("artifacts/cinematic-preview");
const mode = process.argv[2] ?? "verify";

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return { ctx, page, errors };
}

/** The overlay reports "done" and then removes itself ~0.7 s later; accept either. */
async function waitDone(page, timeout = 20000) {
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-intro-phase]");
    return !el || el.getAttribute("data-intro-phase") === "done";
  }, null, { timeout });
}

async function waitFilm(page) {
  await page.waitForFunction(() => !!window.__cinematic, null, { timeout: 30000 });
}

async function shotList(page) {
  return page.evaluate(async () => {
    const m = await import("/src/cinematic/script.ts");
    return m.SHOTS.map((s) => ({ id: s.id, start: s.start, end: s.end, kind: s.kind, note: s.note, scene: s.scene }));
  });
}

async function contact(browser) {
  const dir = path.join(OUT, "frames");
  await mkdir(dir, { recursive: true });
  const { ctx, page } = await newPage(browser, { deviceScaleFactor: 1 });
  await page.goto(`${BASE}/?intro=1&film=painted&paused=1&clean=1`);
  await waitFilm(page);
  const shots = await shotList(page);
  const rows = [];
  for (const s of shots) {
    const t = s.start + (s.end - s.start) * 0.6;
    await page.evaluate((x) => window.__cinematic.seek(x), t);
    await page.waitForTimeout(250);
    const file = `${s.id}-${s.kind}.png`;
    await page.screenshot({ path: path.join(dir, file) });
    rows.push({ ...s, file, t });
  }
  const html = `<!doctype html><meta charset="utf-8"><title>Opening cinematic contact sheet</title>
<style>body{background:#0a090c;color:#efece4;font:14px/1.4 Georgia,serif;margin:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px}
figure{margin:0}img{width:100%;display:block;border:1px solid #333}figcaption{margin-top:6px;color:#c4c0b4}
b{color:#efece4}</style><h1>Opening cinematic — contact sheet</h1><div class="grid">
${rows.map((r) => `<figure><img src="frames/${r.file}" alt=""><figcaption><b>${r.id}</b> ${r.start.toFixed(1)}–${r.end.toFixed(1)}s · ${r.kind}<br>${r.note}</figcaption></figure>`).join("\n")}
</div>`;
  await writeFile(path.join(OUT, "contact-sheet.html"), html);
  await ctx.close();
  console.log(`contact sheet: ${path.join(OUT, "contact-sheet.html")} (${rows.length} shots)`);
}

async function video(browser) {
  await mkdir(OUT, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?intro=1&film=painted`);
  await waitFilm(page);
  await page.waitForFunction(() => window.__cinematic && window.__cinematic.time() >= window.__cinematic.duration - 0.05, null, { timeout: 120000, polling: 500 });
  await page.waitForTimeout(1500);
  const v = page.video();
  await ctx.close();
  console.log(`video: ${await v.path()}`);
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function verify(browser) {
  await mkdir(OUT, { recursive: true });

  // 1. First visit: film plays; save keys untouched; audio waits for a gesture.
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("ganryu-save-v1", JSON.stringify({ fighterId: "kage", maxLevel: 3, currentLevel: 3, wins: 2, losses: 1 }));
        sessionStorage.setItem("seeded", "1");
      }
    });
    await page.goto(`${BASE}/`);
    await waitFilm(page);
    check("first visit plays the film", (await page.getAttribute("[data-intro-phase]", "data-intro-phase")) === "film");
    const t0 = await page.evaluate(() => window.__cinematic.time());
    await page.waitForTimeout(1500);
    const t1 = await page.evaluate(() => window.__cinematic.time());
    check("film clock advances", t1 > t0 + 0.8, `${t0.toFixed(2)} → ${t1.toFixed(2)}`);
    check("audio is locked before a gesture", (await page.evaluate(() => window.__cinematic.audio())) === "locked");
    await page.getByTestId("intro-sound").click();
    await page.waitForTimeout(300);
    check("sound starts after tapping Sound", (await page.evaluate(() => window.__cinematic.audio())) === "running");
    await page.waitForTimeout(800);
    const vo = await page.evaluate(() => window.__cinematic.voices && window.__cinematic.voices());
    const ft = await page.evaluate(() => window.__cinematic.time());
    check("tapping Sound leaves sound on (not muted)", (await page.getByTestId("intro-sound").getAttribute("aria-pressed")) === "true");
    check("voice track plays in sync with the film", !!vo && vo.playing && !vo.muted && Math.abs(vo.time - ft) < 1.0, JSON.stringify({ ...vo, film: ft }));
    await page.getByTestId("intro-subtitles").click();
    check("subtitles toggle off", (await page.getByTestId("intro-subtitles").getAttribute("aria-pressed")) === "false");
    await page.getByTestId("intro-subtitles").click();
    await page.evaluate(() => window.__cinematic.seek(4.5));
    await page.waitForTimeout(300);
    check("subtitle shows at 4.5s", (await page.getByTestId("intro-captions").innerText()).includes("Steady your feet"));
    await page.screenshot({ path: path.join(OUT, "desktop-subtitle.png") });
    const ready = await page.waitForFunction(() => document.querySelector("[data-testid=intro-skip]")?.textContent?.includes("Continue"), null, { timeout: 30000 }).then(() => true, () => false);
    check("loading completes behind the film (Skip becomes Continue)", ready);
    check("film keeps playing after loading completes", (await page.getAttribute("[data-intro-phase]", "data-intro-phase")) === "film");
    await page.getByTestId("intro-skip").click();
    await waitDone(page, 10000);
    await page.waitForTimeout(900);
    check("Continue reaches the title menu", await page.getByTestId("replay-intro").isVisible());
    const stored = await page.evaluate(() => ({ intro: localStorage.getItem("ganryu-intro-v1"), save: localStorage.getItem("ganryu-save-v1") }));
    check("explicit skip is remembered", JSON.parse(stored.intro ?? "{}").outcome === "skipped", stored.intro ?? "");
    check("player save is preserved", JSON.parse(stored.save ?? "{}").maxLevel === 3, stored.save ?? "");
    check("cinematic overlay cleaned up", (await page.$("[data-testid=intro-film]")) === null && (await page.evaluate(() => window.__cinematic === undefined)));
    await page.screenshot({ path: path.join(OUT, "desktop-menu.png") });

    // Reload: returning player skips the film.
    await page.reload();
    await waitDone(page, 30000).catch(() => undefined);
    await page.waitForTimeout(900);
    check("returning player goes to the menu", (await page.$("[data-testid=intro-film]")) === null && (await page.getByTestId("replay-intro").isVisible()));

    // Replay from the menu, then complete it.
    await page.getByTestId("replay-intro").click();
    await waitFilm(page);
    check("Replay Intro restarts the film", (await page.evaluate(() => window.__cinematic.time())) < 2);
    await page.waitForTimeout(400);
    check("replay starts audio without another tap", (await page.evaluate(() => window.__cinematic.audio())) === "running");
    await page.evaluate(() => window.__cinematic.seek(window.__cinematic.duration - 0.4));
    await waitDone(page, 10000);
    const rec = await page.evaluate(() => JSON.parse(localStorage.getItem("ganryu-intro-v1") ?? "{}"));
    check("completion is remembered", rec.outcome === "completed");
    // a missing rendered film (404) is an allowed state: the canvas film plays instead
    const real = errors.filter((e) => !(e.includes("404") && !e.includes("pageerror")));
    check("no page errors", real.length === 0, real.slice(0, 3).join(" | "));
    await ctx.close();
  }

  // 2. Skip before loading finishes → honest loading state → menu.
  {
    const { ctx, page } = await newPage(browser);
    // Hold every portrait request so loading is genuinely incomplete.
    let release;
    const gate = new Promise((r) => (release = r));
    await page.route(/\/fighters\/.*\.webp$/, async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto(`${BASE}/?intro=1&film=painted`);
    await waitFilm(page);
    const label = await page.getByTestId("intro-skip").innerText();
    check("Skip label while loading", /skip/i.test(label), label);
    await page.getByTestId("intro-skip").click();
    await page.waitForSelector("[data-testid=intro-loading]", { timeout: 5000 }).catch(() => undefined);
    const loadingShown = (await page.$("[data-testid=intro-loading]")) !== null;
    check("skip before loading shows the loading state", loadingShown);
    await page.screenshot({ path: path.join(OUT, "loading-state.png") });
    await page.waitForTimeout(1500);
    check("loading state does not complete on a timer", (await page.$("[data-testid=intro-loading]")) !== null);
    release();
    await waitDone(page, 20000);
    await page.waitForTimeout(900);
    check("menu appears once loading completes", await page.getByTestId("replay-intro").isVisible());
    await ctx.close();
  }

  // 3. Film ends before loading → loading state.
  {
    const { ctx, page } = await newPage(browser);
    let release;
    const gate = new Promise((r) => (release = r));
    await page.route(/\/fighters\/.*\.webp$/, async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto(`${BASE}/?intro=1&film=painted`);
    await waitFilm(page);
    await page.evaluate(() => window.__cinematic.seek(window.__cinematic.duration - 0.3));
    await page.waitForSelector("[data-testid=intro-loading]", { timeout: 5000 }).catch(() => undefined);
    check("film ending before loading shows the loading state", (await page.$("[data-testid=intro-loading]")) !== null);
    release();
    await waitDone(page, 20000).then(() => check("then continues to the menu", true), () => check("then continues to the menu", false));
    await ctx.close();
  }

  // 4. Mobile layouts and reduced motion.
  for (const [name, opts] of [
    ["mobile-portrait", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ["mobile-landscape", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ["reduced-motion", { viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" }],
  ]) {
    const { ctx, page } = await newPage(browser, opts);
    await page.goto(`${BASE}/?intro=1&film=painted&paused=1`);
    await waitFilm(page);
    await page.evaluate(() => window.__cinematic.seek(24.6));
    await page.waitForTimeout(400);
    const box = await page.getByTestId("intro-skip").boundingBox();
    const vw = opts.viewport.width;
    check(`${name}: Skip is on screen and touch-sized`, !!box && box.x + box.width <= vw && box.height >= 44, JSON.stringify(box));
    const cap = await page.getByTestId("intro-captions").boundingBox();
    check(`${name}: subtitles fit the viewport`, !!cap && cap.x >= 0 && cap.x + cap.width <= vw && cap.y + cap.height <= opts.viewport.height, JSON.stringify(cap));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(`${name}: no horizontal overflow`, !overflow);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    await ctx.close();
  }

  const failed = results.filter((r) => !r.ok);
  await writeFile(path.join(OUT, "verify.json"), JSON.stringify(results, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}

const browser = await chromium.launch({ args: ["--autoplay-policy=user-gesture-required"] });
try {
  if (mode === "contact") await contact(browser);
  else if (mode === "video") await video(browser);
  else await verify(browser);
} finally {
  await browser.close();
}
