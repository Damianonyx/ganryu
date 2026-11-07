// Motion linter (docs/MOTION.md → "Checks"). Flags raw curves and durations in
// components and routes so every animation goes through the motion tokens in
// src/styles.css (--dur-*, --ease-*) and src/game/motion.ts.
//
//   npm run lint:motion
//
// A line can opt out with `motion-lint-ignore` and a reason, e.g. a value
// that is content rather than motion.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/components", "src/routes"];
const RULES = [
  { re: /cubic-bezier\(/, msg: "Use an --ease-* token (ease-(--ease-enter))" },
  { re: /(?<![a-zA-Z0-9.])\d+(?:\.\d+)?ms(?![a-zA-Z0-9])/, msg: "Use a --dur-* token (duration-(--dur-base))" },
  // duration-0 (instant) is allowed: it is the absence of motion, not a timing choice.
  { re: /\bduration-(?!0\b)\d+\b/, msg: "Use a duration token: duration-(--dur-fast|base|slow|scene)" },
  { re: /transition:\s*all\b|\btransition-all\b/, msg: "Never transition all; name the property" },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|css)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

let failed = 0;
for (const file of ROOTS.flatMap((r) => walk(r))) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (line.includes("motion-lint-ignore")) return;
      for (const { re, msg } of RULES) {
        if (re.test(line) && !(msg.includes("--dur-*") && line.includes("var(--"))) {
          console.log(`${file}:${i + 1}  ${msg}\n    ${line.trim().slice(0, 140)}`);
          failed += 1;
        }
      }
    });
}
console.log(failed ? `\n${failed} motion issue(s).` : "motion-lint: clean");
process.exit(failed ? 1 : 0);
