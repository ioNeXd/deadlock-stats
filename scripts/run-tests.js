// =============================================================================
// TEST RUNNER
// Scans tests/ for *.test.js and passes each file explicitly to node --test.
// This avoids the fragile directory/glob resolution of `node --test tests/`,
// which behaves differently across Node versions (e.g. v20 vs v24).
// =============================================================================

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = path.join(__dirname, "..", "tests");

const testFiles = fs
  .readdirSync(TESTS_DIR)
  .filter((f) => f.endsWith(".test.js"))
  .sort()
  .map((f) => path.join(TESTS_DIR, f));

if (testFiles.length === 0) {
  console.error("No test files found in tests/");
  process.exit(1);
}

console.log(`Running ${testFiles.length} test file(s)...\n`);

try {
  execFileSync(process.execPath, ["--test", ...testFiles], {
    stdio: "inherit",
  });
} catch {
  process.exit(1);
}
