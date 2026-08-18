// =============================================================================
// SYNTAX CHECKER
// Runs `node --check` on every module in js/ so a syntax error anywhere
// (including render-only modules) fails CI, not just imported modules.
// =============================================================================

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const JS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "js");
const files = fs
  .readdirSync(JS_DIR)
  .filter((f) => f.endsWith(".js"))
  .sort();

let failed = 0;

for (const file of files) {
  const full = path.join(JS_DIR, file);
  try {
    execFileSync(process.execPath, ["--check", full], { stdio: "pipe" });
    console.log(`✅ ${file}`);
  } catch (err) {
    failed += 1;
    const detail = err.stderr ? err.stderr.toString().trim() : err.message;
    console.error(`❌ ${file}: ${detail}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} file(s) failed syntax check.`);
  process.exit(1);
}

console.log(`\nAll ${files.length} JS modules passed syntax check.`);
