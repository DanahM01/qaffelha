// يتأكد إن ما فيه ألوان مباشرة داخل host/ و player/
// التشغيل من مجلد client:  node src/theme/check-colors.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIRS = ["host", "player"];
const RULE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|lab)\s*\(/g;
let bad = 0;

function walk(dir) {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.(jsx?|css)$/.test(name)) continue;
    readFileSync(p, "utf8").split("\n").forEach((line, i) => {
      const hits = line.match(RULE);
      if (hits) { bad++; console.log(`${p}:${i + 1}  ${hits.join(", ")}  ← استخدموا var(--q-…)`); }
    });
  }
}
DIRS.forEach((d) => walk(join(src, d)));
if (bad) { console.error(`\n✗ ${bad} سطر فيه لون مباشر`); process.exit(1); }
console.log("✓ ما فيه ألوان مباشرة في host/ و player/");
