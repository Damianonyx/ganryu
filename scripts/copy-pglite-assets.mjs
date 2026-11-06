// Nitro bundles @electric-sql/pglite into the server function but not the
// files it loads at runtime (pglite.data, pglite.wasm, initdb.wasm). Without
// them the in-memory database fallback cannot start and the server function
// crashes. Copy them next to the bundled module after `vite build`.
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const src = "node_modules/@electric-sql/pglite/dist";
const targets = ["_libs", "_chunks", ""].map((d) => join(".vercel/output/functions/__server.func", d));
const files = readdirSync(src).filter((f) => /\.(data|wasm)$/.test(f));
let copied = 0;
for (const dir of targets) {
  if (!existsSync(dir)) continue;
  for (const f of files) {
    copyFileSync(join(src, f), join(dir, f));
    copied += 1;
  }
}
console.log(`[pglite-assets] copied ${copied} file(s)`);
