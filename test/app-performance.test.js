import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [bootstrapSource, runtimeSource, dashboardSource] = await Promise.all([
  readFile(new URL("../src/app.js", import.meta.url), "utf8"),
  readFile(new URL("../src/app-runtime.js", import.meta.url), "utf8"),
  readFile(new URL("../src/dashboard-route.js", import.meta.url), "utf8"),
]);
const appSource = bootstrapSource + "
" + runtimeSource + "
" + dashboardSource;

function extractTopLevelFunction(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1);
  const next = source.slice(start + marker.length).search(/\r?
(?:async )?function /);
  return next === -1 ? source.slice(start) : source.slice(start, start + marker.length + next);
}

test("app resolves explicit dashboard hash route", () => {
  const routeStart = appSource.indexOf("function route()");
  assert.notEqual(routeStart, -1);
  const routeSource = appSource.slice(routeStart);
  assert.match(routeSource, /if \(routeName === "dashboard"\) renderDashboard\(signal\);/);
  assert.match(routeSource, /else renderNotFound\(routeName\);/);
});

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

test("build detail isolates optional hero and tag catalog failures", () => {
  const routeSource = extractTopLevelFunction(appSource, "async function renderBuildDetail");
  assert.match(routeSource, /Promise\.allSettled\(\[/);
  assert.match(routeSource, /heroSettlement\.status === "fulfilled" \? heroSettlement\.value : null/);
  assert.match(routeSource, /tagSettlement\.status === "fulfilled" \? tagSettlement\.value : \{ data: \[\] \}/);
});

test("build detail fetches only the selected hero asset", () => {
  const routeSource = extractTopLevelFunction(appSource, "async function renderBuildDetail");
  assert.match(routeSource, /assetsRuntime\.fetchHero\(numericHeroId/);
  assert.doesNotMatch(routeSource, /assetsRuntime\.listHeroes\(\{ \.\.\.assetVersion\.options\(\), signal \}\)/);
  assert.match(routeSource, /const hero = heroResult\?\.data \?\? null/);
});

test("item detail isolates definition from analytics failures", () => {
  const routeSource = extractTopLevelFunction(appSource, "async function renderItemDetail");
  assert.match(routeSource, /Promise\.allSettled\(\[/);
  assert.match(routeSource, /itemSettlement\.status !== "fulfilled"/);
  assert.match(routeSource, /statsSettlement\.status === "fulfilled" \? statsSettlement\.value : \[\]/);
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

test("player detail defers hero stats request", () => {
  const routeSource = extractTopLevelFunction(appSource, "async function renderPlayerDetail");
  const criticalEnd = routeSource.indexOf("const snapshot = await players.getPlayerDetailCoreSnapshot(numericAccountId, { signal });");
  assert.notEqual(criticalEnd, -1);
  const criticalLoad = routeSource.slice(0, criticalEnd);
  assert.doesNotMatch(criticalLoad, /getPlayerHeroStatsSnapshot/);
  assert.match(routeSource, /getPlayerHeroStatsSnapshot\(numericAccountId, \{ signal \}\)/);
  assert.match(routeSource, /model\.heroStats = result\.heroStats/);
});

test("player detail defers asset runtime loading", () => {
  const routeSource = extractTopLevelFunction(appSource, "async function renderPlayerDetail");
  const criticalEnd = routeSource.indexOf("const snapshot = await players.getPlayerDetailCoreSnapshot(numericAccountId, { signal });");
  assert.notEqual(criticalEnd, -1);
  const criticalLoad = routeSource.slice(0, criticalEnd);
  assert.doesNotMatch(criticalLoad, /loadAssetsRuntime\(\)/);
  assert.match(routeSource, /loadAssetsRuntime\(\)\.then\(assetsRuntime => assetsRuntime\.fetchRank/);
  assert.match(routeSource, /loadAssetsRuntime\(\)\.then\(assetsRuntime => assetsRuntime\.listHeroes/);
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
  const criticalRankEnd = routeSource.indexOf("const rank = model.rank ?? {};");
  assert.notEqual(criticalRankEnd, -1);
  const criticalRankPath = routeSource.slice(0, criticalRankEnd);
  assert.doesNotMatch(criticalRankPath, /assetsRuntime\.fetchRank\(rankTier/);
  assert.match(routeSource, /setTimeout\(\(\) => \{/);
  assert.match(routeSource, /assetsRuntime\.fetchRank\(rankTier/);
  assert.match(routeSource, /data-player-rank/);
  assert.doesNotMatch(routeSource, /assetsRuntime\.listRanks\(\{ \.\.\.assetVersion\.options\(\), signal \}\)/);
  assert.match(routeSource, /players\.loadSteamProfiles\(\[numericAccountId\], \{ signal \}\)/);
  assert.match(routeSource, /data-player-profile/);
  assert.match(routeSource, /players\.getPlayerRelationsSnapshot\(numericAccountId, \{ signal \}\)/);
  assert.match(routeSource, /Loading enemy and teammate stats/);
  assert.match(routeSource, /model\.enemyStats = Array\.isArray\(relations\?\.enemyStats\)/);
  assert.match(routeSource, /model\.mateStats = Array\.isArray\(relations\?\.mateStats\)/);
});

test("player detail splits non-critical history and relation stats from the core snapshot service", async () => {
  const source = await readFile(new URL("../src/services/players.js", import.meta.url), "utf8");
  assert.match(source, /export async function getPlayerDetailCoreSnapshot\(accountId, options = \{\}\)/);
  assert.match(source, /export async function getPlayerMatchHistorySnapshot\(accountId, options = \{\}\)/);
  assert.match(source, /export async function getPlayerRelationsSnapshot\(accountId, options = \{\}\)/);
  const coreStart = source.indexOf("export async function getPlayerDetailCoreSnapshot");
  const historyStart = source.indexOf("export async function getPlayerMatchHistorySnapshot");
  const relationsStart = source.indexOf("export async function getPlayerRelationsSnapshot");
  assert.notEqual(coreStart, -1);
  assert.notEqual(historyStart, -1);
  assert.notEqual(relationsStart, -1);
  const coreSource = source.slice(coreStart, historyStart);
  assert.doesNotMatch(coreSource, /loadPlayerMatchHistory\(/);
  assert.doesNotMatch(coreSource, /loadPlayerEnemyStats\(/);
  assert.doesNotMatch(coreSource, /loadPlayerMateStats\(/);
  assert.match(source.slice(historyStart, relationsStart), /loadPlayerMatchHistory\(accountId, options\)/);
  assert.match(source.slice(relationsStart), /loadPlayerEnemyStats\(accountId, options\)/);
  assert.match(source.slice(relationsStart), /loadPlayerMateStats\(accountId, options\)/);
});

test("player detail defers match history request", () => {
  const routeSource = extractTopLevelFunction(appSource, "async function renderPlayerDetail");
  const criticalEnd = routeSource.indexOf("const snapshot = await players.getPlayerDetailCoreSnapshot(numericAccountId, { signal });");
  assert.notEqual(criticalEnd, -1);
  const criticalLoad = routeSource.slice(0, criticalEnd);
  assert.doesNotMatch(criticalLoad, /getPlayerMatchHistorySnapshot/);
  assert.match(routeSource, /getPlayerMatchHistorySnapshot\(numericAccountId, \{ signal \}\)/);
  assert.match(routeSource, /model\.matchHistory = result\.matchHistory/);
  assert.match(routeSource, /Loading match history…/);
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

test("dashboard starts hero catalog independently from core request", () => {
  const routeSource = extractTopLevelFunction(appSource, "async function loadDashboard");
  const coreIndex = routeSource.indexOf("dashboardRuntime.getDashboardCoreSnapshot(options)");
  const heroCallIndex = routeSource.indexOf("loadHeroes();");
  const assetRuntimeIndex = routeSource.indexOf("loadAssetsRuntime()");
  assert.notEqual(coreIndex, -1);
  assert.notEqual(heroCallIndex, -1);
  assert.notEqual(assetRuntimeIndex, -1);
  assert.ok(heroCallIndex < routeSource.indexOf("getDashboardActivitySnapshot(options)"));
  assert.doesNotMatch(routeSource, /await loadHeroes\(\)/);
  assert.match(routeSource, /assetsRuntime\.listHeroes\(options\)/);
});

test("dashboard defers patch feed from initial render", () => {
  const routeSource = extractTopLevelFunction(appSource, "async function loadDashboard");
  assert.match(routeSource, /getDashboardCoreSnapshot\(options\)/);
  assert.doesNotMatch(routeSource, /getDashboardSnapshot\(options\)/);
  assert.match(routeSource, /getDashboardPatchSnapshot\(options\)\.then\(/);
});

test("app defers dashboard runtime", () => {
  assert.doesNotMatch(appSource, /from ["']\.\/services\/dashboard\.js["']/);
  assert.match(appSource, /import\(\s*["']\.\/services\/dashboard\.js["']/);
});

test("app defers API status runtime", () => {
  assert.doesNotMatch(appSource, /from ["']\.\/services\/api-status\.js["']/);
  assert.match(appSource, /import\(\s*["']\.\/services\/api-status\.js["']/);
});


test("dashboard consumes the core snapshot directly", () => {
  const routeSource = extractTopLevelFunction(appSource, "async function loadDashboard");
  assert.match(routeSource, /snapshot = await dashboardRuntime\.getDashboardCoreSnapshot\(options\)/);
  assert.match(routeSource, /catch \(error\)/);
  assert.doesNotMatch(routeSource, /coreResult\.status/);
  assert.doesNotMatch(routeSource, /heroesResult/);
});


test("dashboard keeps deferred work alive when the core request fails", () => {
  const routeSource = extractTopLevelFunction(appSource, "async function loadDashboard");
  const coreEnd = routeSource.indexOf("if (signal.aborted) return;", routeSource.indexOf("getDashboardCoreSnapshot"));
  assert.notEqual(coreEnd, -1);
  const afterCore = routeSource.slice(coreEnd);
  assert.match(afterCore, /loadHeroes\(\)/);
  assert.match(afterCore, /getDashboardPatchSnapshot\(options\)\.then\(/);
});


test("dashboard defers game activity from the critical info request", () => {
  const routeSource = extractTopLevelFunction(appSource, "async function loadDashboard");
  const coreIndex = routeSource.indexOf("await dashboardRuntime.getDashboardCoreSnapshot(options)");
  const activityIndex = routeSource.indexOf("getDashboardActivitySnapshot(options).then(");
  assert.notEqual(coreIndex, -1);
  assert.notEqual(activityIndex, -1);
  assert.ok(coreIndex < activityIndex);
});
