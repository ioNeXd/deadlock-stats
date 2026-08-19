import test from "node:test";
import assert from "node:assert/strict";
import { mapStatsToRows } from "../js/table.js";

// --- mapStatsToRows ---

test("mapStatsToRows computes winRate and pickRate for heroes", () => {
  const stats = [
    { hero_id: 1, wins: 7, matches: 10 },
    { hero_id: 2, wins: 3, matches: 10 },
  ];
  const entitiesById = {
    1: { name: "Hero A", images: {} },
    2: { name: "Hero B", images: {} },
  };
  const rows = mapStatsToRows(stats, entitiesById, "hero_id", "heroes", 100);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "Hero A");
  assert.equal(rows[0].winRate, 70);
  assert.equal(rows[0].pickRate, 10); // 10/100 * 100
  assert.equal(rows[1].winRate, 30);
  assert.equal(rows[1].pickRate, 10);
});

test("mapStatsToRows computes pickRate for items (12 slots per match)", () => {
  const stats = [{ item_id: 42, wins: 5, matches: 20 }];
  const entitiesById = {
    42: { name: "Item X", images: {} },
  };
  // totalMatches=100 → totalItemSlots=1200 → pickRate = 20/1200*100 ≈ 1.667%
  const rows = mapStatsToRows(stats, entitiesById, "item_id", "items", 100);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Item X");
  assert.equal(rows[0].winRate, 25); // 5/20*100
  assert.ok(Math.abs(rows[0].pickRate - 1.667) < 0.01);
});

test("mapStatsToRows defaults name to Unknown when entity is missing", () => {
  const stats = [{ hero_id: 999, wins: 1, matches: 5 }];
  const entitiesById = {};
  const rows = mapStatsToRows(stats, entitiesById, "hero_id", "heroes", 50);
  assert.equal(rows[0].name, "Unknown");
  assert.equal(rows[0].winRate, 20);
});

test("mapStatsToRows handles zero matches gracefully (no division by zero)", () => {
  const stats = [{ hero_id: 1, wins: 0, matches: 0 }];
  const entitiesById = { 1: { name: "Zero Hero", images: {} } };
  const rows = mapStatsToRows(stats, entitiesById, "hero_id", "heroes", 0);
  assert.equal(rows[0].winRate, 0);
  assert.equal(rows[0].pickRate, 0);
});

test("mapStatsToRows returns empty array for empty stats", () => {
  const rows = mapStatsToRows([], {}, "hero_id", "heroes", 100);
  assert.deepEqual(rows, []);
});
