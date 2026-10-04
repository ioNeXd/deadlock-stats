import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

function heroRouteSource() {
  const start = appSource.indexOf("async function renderHeroes");
  const end = appSource.indexOf("async function renderItemDetail", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return appSource.slice(start, end);
}

test("heroes route uses live asset and analytics contracts", () => {
  const source = heroRouteSource();
  assert.match(source, /listHeroes\(\{ \.\.\.assetVersion\.options\(\), signal \}\)/);
  assert.match(source, /analytics\.getHeroStatsSnapshot\(\{ \.\.\.assetVersion\.options\(\), \.\.\.filters, signal \}\)/);
  assert.match(source, /min_hero_matches/);
});

test("heroes route uses normal API portraits instead of fabricated artwork", () => {
  const source = heroRouteSource();
  assert.match(source, /resolveAssetImage\(hero, \[/);
  assert.match(source, /hero_card_gloat_webp/);
});

test("hero detail isolates analytics and asset availability", () => {
  const start = appSource.indexOf("async function renderHeroDetail");
  const end = appSource.indexOf("async function renderItemDetail", start);
  const source = appSource.slice(start, end);
  assert.match(source, /Promise\.allSettled\(\[/);
  assert.match(source, /analyticsResult\.status === "fulfilled"/);
  assert.match(source, /heroSettlement\.status === "fulfilled"/);
});
