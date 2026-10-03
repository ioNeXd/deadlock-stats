import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

function extractTopLevelFunction(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1);
  const next = source.slice(start + marker.length).search(/\r?\n(?:async )?function /);
  return next === -1 ? source.slice(start) : source.slice(start, start + marker.length + next);
}

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
  const routeSource = extractTopLevelFunction(appSource, "async function renderHeroDetail");
  assert.match(routeSource, /assetsRuntime\.fetchHero\(numericHeroId/);
  assert.doesNotMatch(routeSource, /assetsRuntime\.listHeroes\(\{ \.\.\.assetVersion\.options\(\), signal \}\)/);
  assert.match(routeSource, /const hero = heroResult\?\.data \?\? null/);
});

test("build detail fetches only the selected hero asset", () => {
  const routeSource = extractTopLevelFunction(appSource, "async function renderBuildDetail");
  assert.match(routeSource, /assetsRuntime\.fetchHero\(numericHeroId/);
  assert.doesNotMatch(routeSource, /assetsRuntime\.listHeroes\(\{ \.\.\.assetVersion\.options\(\), signal \}\)/);
  assert.match(routeSource, /const hero = heroResult\?\.data \?\? null/);
});

test("item detail fetches only the selected item and scopes analytics", () => {
  const routeSource = extractTopLevelFunction(appSource, "async function renderItemDetail");
  assert.match(routeSource, /assetsRuntime\.fetchItem\(itemId/);
  assert.doesNotMatch(routeSource, /assetsRuntime\.listItems\(/);
  assert.match(routeSource, /include_item_ids: \[Number\(itemId\)\]/);
  assert.match(routeSource, /item_ids: \[Number\(itemId\)\]/);
});

test("match detail uses the single-match metadata endpoint", () => {
  const detailStart = appSource.indexOf("async function renderMatches");
  const routeSource = appSource.slice(detailStart);
  assert.match(routeSource, /matches\.getMatchMetadataSnapshot\(numericMatchId/);
  assert.doesNotMatch(routeSource, /matches\.getBulkMatchMetadataSnapshot\(\{/);
});


test("match listing defers hero and item catalogs until metadata lookup", () => {
  const routeSource = extractTopLevelFunction(appSource, "async function renderMatches");
  const lookupStart = routeSource.indexOf("const loadDetail = async matchId =>");
  assert.notEqual(lookupStart, -1);
  const initialLoad = routeSource.slice(0, lookupStart);
  const lookupSource = routeSource.slice(lookupStart);
  assert.doesNotMatch(initialLoad, /assetsRuntime\.listHeroes\(/);
  assert.doesNotMatch(initialLoad, /assetsRuntime\.listItems\(/);
  assert.match(lookupSource, /assetsRuntime\.listHeroes\(/);
  assert.match(lookupSource, /assetsRuntime\.listItems\(/);
});

test("player detail keeps the initial critical path free of the full hero catalog", () => {
  const routeSource = extractTopLevelFunction(appSource, "async function renderPlayerDetail");
  const criticalEnd = routeSource.indexOf("const model = players.buildPlayerDetailViewModel(snapshot, null);");
  assert.notEqual(criticalEnd, -1);
  const criticalLoad = routeSource.slice(0, criticalEnd);
  assert.match(criticalLoad, /const snapshot = await players\.getPlayerDetailCoreSnapshot\(numericAccountId, \{ signal \}\)/);
  assert.doesNotMatch(criticalLoad, /players\.loadSteamProfiles\(\[numericAccountId\], \{ signal \}\)/);
  assert.doesNotMatch(criticalLoad, /players\.getPlayerRelationsSnapshot\(numericAccountId, \{ signal \}\)/);
  assert.doesNotMatch(criticalLoad, /assetsRuntime\.listHeroes\(/);
  assert.match(routeSource, /setTimeout\(\(\) => \{/);
  assert.match(routeSource, /assetsRuntime\.listHeroes\(\{ \.\.\.assetVersion\.options\(\), signal \}\)/);
  assert.match(routeSource, /heroMap = new Map/);
  assert.match(routeSource, /renderHeroRows\(\);/);
  assert.match(routeSource, /renderHistoryRows\(\);/);
  assert.match(routeSource, /assetsRuntime\.fetchRank\(rankTier/);
  assert.doesNotMatch(routeSource, /assetsRuntime\.listRanks\(\{ \.\.\.assetVersion\.options\(\), signal \}\)/);
  assert.match(routeSource, /players\.loadSteamProfiles\(\[numericAccountId\], \{ signal \}\)/);
  assert.match(routeSource, /data-player-profile/);
  assert.match(routeSource, /players\.getPlayerRelationsSnapshot\(numericAccountId, \{ signal \}\)/);
  assert.match(routeSource, /Loading enemy and teammate stats/);
  assert.match(routeSource, /model\.enemyStats = Array\.isArray\(relations\?\.enemyStats\)/);
  assert.match(routeSource, /model\.mateStats = Array\.isArray\(relations\?\.mateStats\)/);
});

test("player detail splits relation stats from the core snapshot service", async () => {
  const source = await readFile(new URL("../src/services/players.js", import.meta.url), "utf8");
  assert.match(source, /export async function getPlayerDetailCoreSnapshot\(accountId, options = \{\}\)/);
  assert.match(source, /export async function getPlayerRelationsSnapshot\(accountId, options = \{\}\)/);
  const coreStart = source.indexOf("export async function getPlayerDetailCoreSnapshot");
  const relationsStart = source.indexOf("export async function getPlayerRelationsSnapshot");
  assert.notEqual(coreStart, -1);
  assert.notEqual(relationsStart, -1);
  const coreSource = source.slice(coreStart, relationsStart);
  assert.doesNotMatch(coreSource, /loadPlayerEnemyStats\(/);
  assert.doesNotMatch(coreSource, /loadPlayerMateStats\(/);
  assert.match(source.slice(relationsStart), /loadPlayerEnemyStats\(accountId, options\)/);
  assert.match(source.slice(relationsStart), /loadPlayerMateStats\(accountId, options\)/);
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
