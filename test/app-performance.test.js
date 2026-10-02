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

test("hero detail fetches only the selected hero asset", () => {
  const detailStart = appSource.indexOf("async function renderHeroDetail");
  const routeSource = appSource.slice(detailStart);
  assert.match(routeSource, /assetsRuntime\.fetchHero\(numericHeroId/);
  assert.doesNotMatch(routeSource, /assetsRuntime\.listHeroes\(\{ \.\.\.assetVersion\.options\(\), signal \}\)/);
  assert.match(routeSource, /const hero = heroResult\?\.data \?\? null/);
});

test("build detail fetches only the selected hero asset", () => {
  const detailStart = appSource.indexOf("async function renderBuildDetail");
  const routeSource = appSource.slice(detailStart);
  assert.match(routeSource, /assetsRuntime\.fetchHero\(numericHeroId/);
  assert.doesNotMatch(routeSource, /assetsRuntime\.listHeroes\(\{ \.\.\.assetVersion\.options\(\), signal \}\)/);
  assert.match(routeSource, /const hero = heroResult\?\.data \?\? null/);
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

test("asset version service avoids eager asset service dependency", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../src/services/asset-version.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from ["']\.\/assets\.js["']/);
  assert.match(source, /from ["']\.\.\/api\/assets\.js["']/);
});

test("app defers dashboard runtime", () => {
  assert.doesNotMatch(appSource, /from ["']\.\/services\/dashboard\.js["']/);
  assert.match(appSource, /import\(\s*["']\.\/services\/dashboard\.js["']/);
});

test("app defers API status runtime", () => {
  assert.doesNotMatch(appSource, /from ["']\.\/services\/api-status\.js["']/);
  assert.match(appSource, /import\(\s*["']\.\/services\/api-status\.js["']/);
});
