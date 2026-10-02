import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

test("app defers non-critical explorer and GraphQL modules", () => {
  assert.doesNotMatch(appSource, /from ["']\.\/services\/(data-explorer|data-explorer-presets|graphql)\.js["']/);
  assert.match(appSource, /import\(\s*["']\.\/services\/data-explorer\.js["']/);
  assert.match(appSource, /import\(\s*["']\.\/services\/graphql\.js["']/);
});

test("app defers asset version network context outside dashboard and maps", () => {
  const routeStart = appSource.indexOf("function route()");
  assert.notEqual(routeStart, -1);
  const routeSource = appSource.slice(routeStart);
  assert.doesNotMatch(appSource.slice(0, routeStart), /loadAssetVersionContext\(\)\.then\(/);
  assert.match(routeSource, /const initialSelectedVersion = assetVersion\.get\(\);\s*loadAssetVersionContext\(\)\.then\(/);
  assert.match(appSource, /if \(routeName === "dashboard" \|\| routeName === "maps"\)\s*\{/);
});

test("app defers analytics runtime until analytics routes", () => {
  assert.doesNotMatch(appSource, /from ["']\.\/services\/analytics\.js["']/);
  assert.match(appSource, /import\(\s*["']\.\/services\/analytics\.js["']/);
});

test("app defers route-specific service runtimes", () => {
  assert.doesNotMatch(appSource, /from ["']\.\/services\/(matches|players|builds|leaderboard)\.js["']/);
  assert.match(appSource, /import\(\s*["']\.\/services\/matches\.js["']/);
  assert.match(appSource, /import\(\s*["']\.\/services\/players\.js["']/);
  assert.match(appSource, /import\(\s*["']\.\/services\/builds\.js["']/);
  assert.match(appSource, /import\(\s*["']\.\/services\/leaderboard\.js["']/);
});

test("app defers asset service runtime", () => {
  assert.doesNotMatch(appSource, /from ["']\.\/services\/assets\.js["']/);
  assert.match(appSource, /import\(\s*["']\.\/services\/assets\.js["']/);
});
