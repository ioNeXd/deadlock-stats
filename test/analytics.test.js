import test from "node:test";
import assert from "node:assert/strict";

import { getGameStats, getHeroBanStats, getHeroStats, getHeroCounterStats, getHeroSynergyStats, getHeroCombStats, getHeroBuildStats, getAbilityOrderStats, getBadgeDistribution, getBuffStats, getBuildItemStats, getItemStats, getItemPermutationStats, getItemFlowStats } from "../src/api/analytics.js";
import { normalizeGameStats, normalizeHeroBanStats, normalizeBadgeDistribution, normalizeHeroStats, normalizeHeroCounterStats, normalizeHeroSynergyStats, normalizeHeroCombStats, normalizeHeroBuildStats, normalizeAbilityOrderStats, normalizeHeroCombAnalytics, normalizeBuildItemStats, normalizeBuffStats, normalizeItemStats, normalizeItemPermutationStats, normalizeItemFlowStats } from "../src/services/analytics.js";
import { clearApiCache } from "../src/api/client.js";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  clearApiCache();
});

test("analytics API wrappers use documented endpoints and query parameters", async () => {
  const calls = [];
  globalThis.fetch = async input => {
    const url = new URL(input);
    calls.push(url);
    return new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  await getGameStats({ bucket: "start_time_day", cache: false, dedupe: false });
  await getHeroBanStats({ bucket: "start_time_day", cache: false, dedupe: false });

  assert.equal(calls[0].pathname, "/v1/analytics/game-stats");
  assert.equal(calls[0].searchParams.get("bucket"), "start_time_day");
  assert.equal(calls[1].pathname, "/v1/analytics/hero-ban-stats");
  assert.equal(calls[1].searchParams.get("bucket"), "start_time_day");
});

test("analytics wrappers forward top-level filters used by services", async () => {
  const calls = [];
  globalThis.fetch = async input => {
    const url = new URL(input);
    calls.push(url);
    return new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  await getHeroStats({ game_mode: "normal", min_duration_s: 600, hero_ids: [7, 8], cache: false, dedupe: false });
  await getHeroCounterStats({ same_lane_filter: true, min_matches: 20, account_ids: [7], cache: false, dedupe: false });
  await getAbilityOrderStats({ hero_id: 7, min_ability_upgrades: 4, account_ids: [7, 8], cache: false, dedupe: false });
  await getItemStats({ hero_ids: [7], enemy_hero_ids: [8], corrupted_items: "include", cache: false, dedupe: false });

  assert.equal(calls[0].searchParams.get("game_mode"), "normal");
  assert.equal(calls[0].searchParams.get("min_duration_s"), "600");
  assert.equal(calls[0].searchParams.get("hero_ids"), "7");
  assert.equal(calls[1].searchParams.get("same_lane_filter"), "true");
  assert.equal(calls[1].searchParams.get("min_matches"), "20");
  assert.equal(calls[1].searchParams.get("account_ids"), "7");
  assert.equal(calls[2].searchParams.get("hero_id"), "7");
  assert.equal(calls[2].searchParams.get("min_ability_upgrades"), "4");
  assert.equal(calls[2].searchParams.get("account_ids"), "7");
  assert.equal(calls[3].searchParams.get("hero_ids"), "7");
  assert.equal(calls[3].searchParams.get("enemy_hero_ids"), "8");
  assert.equal(calls[3].searchParams.get("corrupted_items"), "include");
});

test("analytics normalizers preserve unknown source fields", () => {
  const game = normalizeGameStats({ data: [{ bucket: 20261001, total_matches: 42, avg_kills: 8, future_metric: 9 }] });
  const bans = normalizeHeroBanStats({ data: [{ hero_id: 7, bucket: 20261001, bans: 5, future_metric: 11 }] });

  assert.deepEqual(game[0], {
    bucket: 20261001,
    totalMatches: 42,
    totalPlayers: null,
    avgDurationS: null,
    avgKills: 8,
    avgPlayerDamage: null,
    team0Wins: null,
    team1Wins: null,
    raw: { bucket: 20261001, total_matches: 42, avg_kills: 8, future_metric: 9 },
  });
  assert.deepEqual(bans[0], {
    heroId: 7,
    bucket: 20261001,
    bans: 5,
    raw: { hero_id: 7, bucket: 20261001, bans: 5, future_metric: 11 },
  });
});

test("expanded analytics wrappers use documented paths and preserve query options", async () => {
  const calls = [];
  globalThis.fetch = async input => {
    const url = new URL(input);
    calls.push(url);
    return new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  await getHeroStats({ bucket: "start_time_day", query: { min_hero_matches: 20 }, cache: false, dedupe: false });
  await getHeroCounterStats({ query: { same_lane_filter: true }, cache: false, dedupe: false });
  await getHeroSynergyStats({ query: { min_matches: 20 }, cache: false, dedupe: false });
  await getHeroCombStats({ query: { comb_size: 6 }, cache: false, dedupe: false });
  await getHeroBuildStats(7, { query: { min_matches: 20 }, cache: false, dedupe: false });
  await getAbilityOrderStats({ hero_id: 7, cache: false, dedupe: false });
  await getBadgeDistribution({ cache: false, dedupe: false });
  await getBuffStats({ hero_ids: [7, 8], cache: false, dedupe: false });
  await getBuildItemStats({ hero_id: 7, cache: false, dedupe: false });

  assert.deepEqual(calls.map(url => url.pathname), [
    "/v1/analytics/hero-stats",
    "/v1/analytics/hero-counter-stats",
    "/v1/analytics/hero-synergy-stats",
    "/v1/analytics/hero-comb-stats",
    "/v1/analytics/hero-build-stats/7",
    "/v1/analytics/ability-order-stats",
    "/v1/analytics/badge-distribution",
    "/v1/analytics/buff-stats",
    "/v1/analytics/build-item-stats",
  ]);
  assert.equal(calls[0].searchParams.get("bucket"), "start_time_day");
  assert.equal(calls[0].searchParams.get("min_hero_matches"), "20");
  assert.equal(calls[4].searchParams.get("min_matches"), "20");
  assert.equal(calls[5].searchParams.get("hero_id"), "7");
  assert.deepEqual(calls[7].searchParams.getAll("hero_ids"), ["7", "8"]);
  assert.equal(calls[8].searchParams.get("hero_id"), "7");
});

test("hero stats normalizer follows the current OpenAPI schema", () => {
  const result = normalizeHeroStats({
    data: [{
      hero_id: 7,
      bucket: 20261001,
      wins: 14,
      losses: 11,
      matches: 25,
      matches_per_bucket: 25,
      total_kills: 200,
      total_deaths: 100,
      total_assists: 300,
      total_net_worth: 500000,
      total_last_hits: 1250,
      total_denies: 180,
      total_player_damage: 900000,
      total_player_damage_taken: 700000,
      total_boss_damage: 30000,
      total_creep_damage: 450000,
      total_neutral_damage: 120000,
      total_max_health: 250000,
      total_shots_hit: 12000,
      total_shots_missed: 3000,
      total_permanent_buffs: 80,
      permanent_buff_matches: 20,
      total_first_permanent_buff_time_s: 18000,
      permanent_buff_timing_matches: 20,
      future_metric: "kept",
    }],
  });

  assert.deepEqual(result[0], {
    heroId: 7,
    bucket: 20261001,
    wins: 14,
    losses: 11,
    matches: 25,
    matchesPerBucket: 25,
    totalKills: 200,
    totalDeaths: 100,
    totalAssists: 300,
    totalNetWorth: 500000,
    totalLastHits: 1250,
    totalDenies: 180,
    totalPlayerDamage: 900000,
    totalPlayerDamageTaken: 700000,
    totalBossDamage: 30000,
    totalCreepDamage: 450000,
    totalNeutralDamage: 120000,
    totalMaxHealth: 250000,
    totalShotsHit: 12000,
    totalShotsMissed: 3000,
    totalPermanentBuffs: 80,
    permanentBuffMatches: 20,
    totalFirstPermanentBuffTimeS: 18000,
    permanentBuffTimingMatches: 20,
    raw: {
      hero_id: 7,
      bucket: 20261001,
      wins: 14,
      losses: 11,
      matches: 25,
      matches_per_bucket: 25,
      total_kills: 200,
      total_deaths: 100,
      total_assists: 300,
      total_net_worth: 500000,
      total_last_hits: 1250,
      total_denies: 180,
      total_player_damage: 900000,
      total_player_damage_taken: 700000,
      total_boss_damage: 30000,
      total_creep_damage: 450000,
      total_neutral_damage: 120000,
      total_max_health: 250000,
      total_shots_hit: 12000,
      total_shots_missed: 3000,
      total_permanent_buffs: 80,
      permanent_buff_matches: 20,
      total_first_permanent_buff_time_s: 18000,
      permanent_buff_timing_matches: 20,
      future_metric: "kept",
    },
  });
});

test("hero matchup normalizers follow the current OpenAPI schemas", () => {
  const counter = normalizeHeroCounterStats({
    data: [{
      hero_id: 7,
      enemy_hero_id: 8,
      wins: 12,
      matches_played: 25,
      kills: 200,
      enemy_kills: 180,
      deaths: 100,
      enemy_deaths: 120,
      assists: 300,
      enemy_assists: 280,
      denies: 40,
      enemy_denies: 35,
      last_hits: 500,
      enemy_last_hits: 480,
      networth: 250000,
      enemy_networth: 240000,
      obj_damage: 12000,
      enemy_obj_damage: 11000,
      creeps: 700,
      enemy_creeps: 680,
      future_metric: 99,
    }],
  });
  const synergy = normalizeHeroSynergyStats({
    data: [{
      hero_id1: 7,
      hero_id2: 8,
      wins: 15,
      matches_played: 30,
      kills1: 200,
      kills2: 180,
      deaths1: 100,
      deaths2: 90,
      assists1: 300,
      assists2: 280,
      denies1: 40,
      denies2: 35,
      last_hits1: 500,
      last_hits2: 480,
      networth1: 250000,
      networth2: 240000,
      obj_damage1: 12000,
      obj_damage2: 11000,
      creeps1: 700,
      creeps2: 680,
      future_metric: 99,
    }],
  });
  const comb = normalizeHeroCombStats({
    data: [{ hero_ids: [7, 8, 9], wins: 18, losses: 12, matches: 30, future_metric: 99 }],
  });

  assert.equal(counter[0].heroId, 7);
  assert.equal(counter[0].enemyHeroId, 8);
  assert.equal(counter[0].enemyObjDamage, 11000);
  assert.equal(counter[0].raw.future_metric, 99);

  assert.equal(synergy[0].heroId1, 7);
  assert.equal(synergy[0].heroId2, 8);
  assert.equal(synergy[0].wins, 15);
  assert.equal(synergy[0].raw.future_metric, 99);

  assert.deepEqual(comb[0], {
    heroIds: [7, 8, 9],
    wins: 18,
    losses: 12,
    matches: 30,
    raw: { hero_ids: [7, 8, 9], wins: 18, losses: 12, matches: 30, future_metric: 99 },
  });
});


test("hero build and ability order normalizers follow the current OpenAPI schemas", () => {
  const builds = normalizeHeroBuildStats({
    data: [{
      hero_id: 7,
      hero_build_id: 123,
      wins: 60,
      losses: 40,
      matches: 100,
      players: 35,
      future_metric: 9,
    }],
  });
  const orders = normalizeAbilityOrderStats({
    data: [{
      abilities: [1, 2, 3, 4],
      wins: 70,
      losses: 30,
      matches: 100,
      players: 50,
      total_kills: 900,
      total_deaths: 400,
      total_assists: 1200,
      future_metric: 10,
    }],
  });

  assert.deepEqual(builds[0], {
    heroId: 7,
    heroBuildId: 123,
    wins: 60,
    losses: 40,
    matches: 100,
    players: 35,
    raw: {
      hero_id: 7,
      hero_build_id: 123,
      wins: 60,
      losses: 40,
      matches: 100,
      players: 35,
      future_metric: 9,
    },
  });
  assert.deepEqual(orders[0], {
    abilities: [1, 2, 3, 4],
    wins: 70,
    losses: 30,
    matches: 100,
    players: 50,
    totalKills: 900,
    totalDeaths: 400,
    totalAssists: 1200,
    raw: {
      abilities: [1, 2, 3, 4],
      wins: 70,
      losses: 30,
      matches: 100,
      players: 50,
      total_kills: 900,
      total_deaths: 400,
      total_assists: 1200,
      future_metric: 10,
    },
  });
});


test("combo, build-item and buff normalizers follow current schemas", () => {
  const combos = normalizeHeroCombAnalytics({ data: [{ hero_ids: [1,2,3,4,5,6], wins: 40, losses: 20, matches: 60, future_metric: 1 }] });
  const items = normalizeBuildItemStats({ data: [{ item_id: 123, builds: 77, future_metric: 2 }] });
  const buffs = normalizeBuffStats({ data: [{ buff_type: "hp_permanent_pickup_lv2", is_permanent: true, matches: 100, matches_with_pickup: 50, pickups: 55, timed_matches: 90, timed_pickups: 45, total_stat_value: 1200, avg_first_pickup_time_s: 300, avg_pickup_time_s: 360, future_metric: 3 }] });
  assert.equal(combos[0].heroIds.length, 6);
  assert.equal(combos[0].raw.future_metric, 1);
  assert.equal(items[0].itemId, 123);
  assert.equal(items[0].builds, 77);
  assert.equal(items[0].raw.future_metric, 2);
  assert.equal(buffs[0].buffType, "hp_permanent_pickup_lv2");
  assert.equal(buffs[0].totalStatValue, 1200);
  assert.equal(buffs[0].raw.future_metric, 3);
});


test("badge distribution normalizer follows the current OpenAPI schema", () => {
  const result = normalizeBadgeDistribution({
    data: [
      { badge_level: 73, total_matches: 1200, unique_players: 640, future_metric: "kept" },
    ],
  });

  assert.deepEqual(result[0], {
    badgeLevel: 73,
    totalMatches: 1200,
    uniquePlayers: 640,
    raw: {
      badge_level: 73,
      total_matches: 1200,
      unique_players: 640,
      future_metric: "kept",
    },
  });
});


test("analytics wrappers forward current combo and permutation filters", async () => {
  const calls = [];
  globalThis.fetch = async input => {
    const url = new URL(input);
    calls.push(url);
    return new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  await getHeroCombStats({
    query: {
      include_hero_ids: [7, 8],
      exclude_hero_ids: [9],
      include_enemy_hero_ids: [10],
      exclude_enemy_hero_ids: [11, 12],
    },
    cache: false,
    dedupe: false,
  });
  await getItemPermutationStats({
    query: { hero_id: 7, hero_ids: [8, 9] },
    cache: false,
    dedupe: false,
  });

  assert.deepEqual(calls[0].searchParams.getAll("include_hero_ids"), ["7", "8"]);
  assert.deepEqual(calls[0].searchParams.getAll("exclude_hero_ids"), ["9"]);
  assert.deepEqual(calls[0].searchParams.getAll("include_enemy_hero_ids"), ["10"]);
  assert.deepEqual(calls[0].searchParams.getAll("exclude_enemy_hero_ids"), ["11", "12"]);
  assert.equal(calls[1].searchParams.get("hero_id"), "7");
  assert.equal(calls[1].searchParams.get("hero_ids"), "8,9");
});


test("analytics wrappers forward current combo/item filters and cache TTLs", async () => {
  const calls = [];
  globalThis.fetch = async input => {
    calls.push(new URL(input));
    return new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  await getHeroCombStats({
    query: { min_networth: 1000, max_networth: 5000 },
    cache: true,
    dedupe: false,
  });
  await getItemStats({
    query: { include_corrupted_items: true },
    cache: true,
    dedupe: false,
  });

  assert.equal(calls[0].searchParams.get("min_networth"), "1000");
  assert.equal(calls[0].searchParams.get("max_networth"), "5000");
  assert.equal(calls[1].searchParams.get("include_corrupted_items"), "true");
});


test("analytics wrappers drop filters not documented for each endpoint", async () => {
  const calls = [];
  globalThis.fetch = async input => {
    const url = new URL(input);
    calls.push(url);
    return new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const query = {
    game_mode: "normal",
    match_mode: "ranked",
    min_networth: 1000,
    hero_ids: [7, 8],
    account_ids: [123, 456],
    include_item_ids: [900],
    ability_order_prefix: [1, 2],
    is_low_pri_pool: true,
  };

  await getGameStats({ query, cache: false, dedupe: false });
  await getBadgeDistribution({ query, cache: false, dedupe: false });
  await getHeroBuildStats(7, { query, cache: false, dedupe: false });
  await getBuildItemStats({ query, cache: false, dedupe: false });

  assert.equal(calls[0].searchParams.get("hero_ids"), "7");
  assert.equal(calls[0].searchParams.get("account_ids"), "123");
  assert.equal(calls[0].searchParams.get("is_low_pri_pool"), null);

  assert.equal(calls[1].searchParams.get("is_low_pri_pool"), "true");
  assert.equal(calls[1].searchParams.get("min_networth"), null);
  assert.equal(calls[1].searchParams.get("hero_ids"), null);

  assert.equal(calls[2].searchParams.get("match_mode"), "ranked");
  assert.equal(calls[2].searchParams.get("hero_ids"), null);
  assert.equal(calls[2].searchParams.get("min_networth"), null);
  assert.equal(calls[2].searchParams.get("account_ids"), "123");

  assert.equal(calls[3].searchParams.get("hero_id"), null);
  assert.equal(calls[3].searchParams.get("min_networth"), null);
});


test("item analytics wrappers use documented endpoints and normalize current schemas", async () => {
  const calls = [];
  globalThis.fetch = async input => {
    const url = new URL(input);
    calls.push(url);
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  };

  await getItemStats({ query: { hero_ids: [7, 8], corrupted_items: "include" }, cache: false, dedupe: false });
  await getItemPermutationStats({ query: { hero_ids: [7, 8], item_ids: [101, 202] }, cache: false, dedupe: false });
  await getItemFlowStats({ query: { hero_ids: [7, 8], locked_item_ids: [101, 202], locked_columns: [0, 1] }, cache: false, dedupe: false });

  assert.deepEqual(calls.map(url => url.pathname), [
    "/v1/analytics/item-stats",
    "/v1/analytics/item-permutation-stats",
    "/v1/analytics/item-flow-stats",
  ]);
  assert.equal(calls[0].searchParams.get("hero_ids"), "7,8");
  assert.equal(calls[0].searchParams.get("corrupted_items"), "include");
  assert.equal(calls[1].searchParams.get("hero_ids"), "7,8");
  assert.deepEqual(calls[1].searchParams.getAll("item_ids"), ["101", "202"]);
  assert.deepEqual(calls[2].searchParams.getAll("locked_item_ids"), ["101", "202"]);
  assert.deepEqual(calls[2].searchParams.getAll("locked_columns"), ["0", "1"]);

  const item = normalizeItemStats({ data: [{ item_id: 101, bucket: 0, wins: 60, losses: 40, matches: 100, players: 100, avg_buy_time_s: 420, avg_sell_time_s: 900, avg_buy_time_relative: 0.25, avg_sell_time_relative: 0.5, future_metric: true }] });
  const permutation = normalizeItemPermutationStats({ data: [{ item_ids: [101, 202], wins: 30, losses: 20, matches: 50, future_metric: true }] });
  const flow = normalizeItemFlowStats({ data: { nodes: [{ column: 0, item_id: 101, wins: 60, losses: 40, matches: 100, players: 100, total_kills: 500, total_deaths: 400, total_assists: 800, adjusted_win_rate: 0.58, avg_net_worth_at_buy: 3200, future_metric: true }], edges: [{ from_column: 0, from_item_id: 101, to_item_id: 202, wins: 20, losses: 10, matches: 30 }], summary: { wins: 60, losses: 40, matches: 100, players: 100, total_kills: 500, total_deaths: 400, total_assists: 800, avg_net_worth: 15000, avg_duration_s: 1500 }, baseline: { matches: 120 }, reached_per_column: [120, 80] } });

  assert.equal(item[0].avgBuyTimeS, 420);
  assert.equal(item[0].raw.future_metric, true);
  assert.deepEqual(permutation[0].itemIds, [101, 202]);
  assert.equal(flow.nodes[0].adjustedWinRate, 0.58);
  assert.deepEqual(flow.reachedPerColumn, [120, 80]);
});
