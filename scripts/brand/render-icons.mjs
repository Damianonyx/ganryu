// Render the game icon (scripts/brand/icon.svg) to every size the site and home screens use.
// node scripts/brand/render-icons.mjs [outDir=public]
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] ?? "public";
const svg = readFileSync(new URL("./icon.svg", import.meta.url), "utf8");
mkdirSync(join(out, "icons"), { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ deviceScaleFactor: 1 });
const BG = '<rect width="512" height="512" fill="url(#bg)"/>';
// pad < 1 shrinks the art (not the background) into the middle: Android crops maskable icons to a circle
function art(pad) {
  if (pad === 1) return svg;
  const at = svg.indexOf(BG) + BG.length;
  const o = (512 * (1 - pad)) / 2;
  return `${svg.slice(0, at)}<g transform="translate(${o} ${o}) scale(${pad})">${svg.slice(at, svg.lastIndexOf("</svg>"))}</g></svg>`;
}
async function render(size, file, { pad = 1 } = {}) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0;overflow:hidden">${art(pad).replace("<svg ", `<svg width="${size}" height="${size}" style="display:block" `)}</body></html>`);
  await p.screenshot({ path: join(out, file), clip: { x: 0, y: 0, width: size, height: size } });
}
await render(512, "icons/icon-512.png");
await render(192, "icons/icon-192.png");
await render(512, "icons/icon-maskable-512.png", { pad: 0.8 });
await render(180, "apple-touch-icon.png");
await render(180, "__grok/icon-180.png");
await render(48, "icons/favicon-48.png");
await render(32, "icons/favicon-32.png");
await render(16, "icons/favicon-16.png");
await b.close();
// The SVG favicon: the same art in a rounded tile.
writeFileSync(join(out, "favicon.svg"), svg.replace('<rect width="512" height="512" fill="url(#bg)"/>', '<rect width="512" height="512" rx="96" fill="url(#bg)"/>'));
console.log("icons written to", out);
