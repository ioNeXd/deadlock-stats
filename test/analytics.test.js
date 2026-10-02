import test from "node:test";
import assert from "node:assert/strict";

import { getGameStats, getHeroBanStats, getHeroStats, getHeroCounterStats, getHeroSynergyStats, getHeroCombStats, getHeroBuildStats, getAbilityOrderStats, getBadgeDistribution, getBuffStats, getBuildItemStats, getItemStats, getItemPermutationStats, getItemFlowStats, getLaneMatchupStats, getLaneSoulCurve, getPlayerPerformanceCurve, getPlayerStatsMetrics, getHeroScoreboard, getPlayerScoreboard, getKillDeathStats } from "../src/api/analytics.js";
import { normalizeGameStats, normalizeHeroBanStats, normalizeBadgeDistribution, normalizeHeroStats, getHeroDetailSnapshot, buildHeroDetailViewModel, normalizeHeroCounterStats, normalizeHeroSynergyStats, normalizeHeroCombStats, normalizeHeroBuildStats, normalizeAbilityOrderStats, normalizeHeroCombAnalytics, normalizeBuildItemStats, normalizeBuffStats, normalizeItemStats, normalizeItemPermutationStats, normalizeItemFlowStats, normalizePlayerPerformanceCurve, normalizeHeroScoreboard, normalizePlayerScoreboard, normalizeKillDeathStats, normalizeLaneMatchupStats, normalizeLaneSoulCurve, normalizePlayerStatsMetrics } from "../src/services/analytics.js";
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

test("analytics wrappers forward top-level filters used by services", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async input => {
    calls.push(new URL(input).toString());
    return new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  await getHeroStats({ game_mode: "normal", min_duration_s: 600, cache: false, dedupe: false });
  await getHeroCounterStats({ same_lane_filter: true, min_matches: 20, account_ids: [7], cache: false, dedupe: false });
  await getAbilityOrderStats({ hero_id: 7, min_ability_upgrades: 4, account_ids: [7, 8], cache: false, dedupe: false });
  await getItemStats({ hero_ids: [7], enemy_hero_ids: [8], corrupted_items: "include", cache: false, dedupe: false });

  assert.equal(new URL(calls[0]).searchParams.get("game_mode"), "normal");
  assert.equal(new URL(calls[0]).searchParams.get("min_duration_s"), "600");
  assert.equal(new URL(calls[1]).searchParams.get("same_lane_filter"), "true");
  assert.equal(new URL(calls[1]).searchParams.get("min_matches"), "20");
  assert.equal(new URL(calls[1]).searchParams.get("account_ids"), "7");
  assert.equal(new URL(calls[2]).searchParams.get("hero_id"), "7");
  assert.equal(new URL(calls[2]).searchParams.get("min_ability_upgrades"), "4");
  assert.equal(new URL(calls[2]).searchParams.get("account_ids"), "7,8");
  assert.equal(new URL(calls[3]).searchParams.get("hero_ids"), "7");
  assert.equal(new URL(calls[3]).searchParams.get("enemy_hero_ids"), "8");
  assert.equal(new URL(calls[3]).searchParams.get("corrupted_items"), "include");
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
  assert.equal(calls[7].searchParams.get("hero_ids"), "7,8");
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

test("hero detail snapshot composes current hero analytics sources", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async input => {
    const url = new URL(input);
    calls.push(url);
    const payload = url.pathname === "/v1/analytics/hero-stats"
      ? [{ hero_id: 7, matches: 20, wins: 12 }]
      : [];
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const snapshot = await getHeroDetailSnapshot(7, {
    game_mode: "normal",
    cache: false,
    dedupe: false,
  });

  assert.equal(calls.length, 5);
  assert.deepEqual(calls.map(url => url.pathname).sort(), [
    "/v1/analytics/ability-order-stats",
    "/v1/analytics/hero-build-stats/7",
    "/v1/analytics/hero-counter-stats",
    "/v1/analytics/hero-stats",
    "/v1/analytics/hero-synergy-stats",
  ]);
  assert.deepEqual(snapshot.stats, [{ heroId: 7, bucket: null, wins: 12, losses: null, matches: 20, matchesPerBucket: null, totalKills: null, totalDeaths: null, totalAssists: null, totalNetWorth: null, totalLastHits: null, totalDenies: null, totalPlayerDamage: null, totalPlayerDamageTaken: null, totalBossDamage: null, totalCreepDamage: null, totalNeutralDamage: null, totalMaxHealth: null, totalShotsHit: null, totalShotsMissed: null, totalPermanentBuffs: null, permanentBuffMatches: null, totalFirstPermanentBuffTimeS: null, permanentBuffTimingMatches: null, raw: { hero_id: 7, matches: 20, wins: 12 } }]);
  assert.equal(snapshot.counters.length, 0);
  assert.equal(snapshot.synergies.length, 0);
  assert.equal(snapshot.builds.length, 0);
  assert.equal(snapshot.abilityOrders.length, 0);
});

test("hero detail view model derives overview and ordered collections", () => {
  const model = buildHeroDetailViewModel({
    heroId: 7,
    stats: [{ heroId: 7, wins: 12, losses: 8, matches: 20, totalKills: 100, totalDeaths: 50, totalAssists: 150, totalNetWorth: 200000, totalLastHits: 800, totalDenies: 100, totalPlayerDamage: 500000, totalPlayerDamageTaken: 300000 }],
    counters: [
      { heroId: 7, enemyHeroId: 8, matchesPlayed: 5 },
      { heroId: 7, enemyHeroId: 9, matchesPlayed: 20 },
    ],
    synergies: [
      { heroId1: 7, heroId2: 10, matchesPlayed: 4 },
      { heroId1: 11, heroId2: 7, matchesPlayed: 30 },
    ],
    builds: [
      { heroBuildId: 1, matches: 10 },
      { heroBuildId: 2, matches: 40 },
    ],
    abilityOrders: [
      { abilities: [1, 2], matches: 5 },
      { abilities: [2, 1], matches: 25 },
    ],
  }, { id: 7, name: "Test Hero" });

  assert.equal(model.hero.name, "Test Hero");
  assert.equal(model.overview.winRate, 60);
  assert.deepEqual(model.counters.map(item => item.enemyHeroId), [9, 8]);
  assert.deepEqual(model.synergies.map(item => item.heroId2), [7, 10]);
  assert.deepEqual(model.builds.map(item => item.heroBuildId), [2, 1]);
  assert.deepEqual(model.abilityOrders.map(item => item.matches), [25, 5]);
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

  assert.equal(calls[0].searchParams.get("include_hero_ids"), "7,8");
  assert.equal(calls[0].searchParams.get("exclude_hero_ids"), "9");
  assert.equal(calls[0].searchParams.get("include_enemy_hero_ids"), "10");
  assert.equal(calls[0].searchParams.get("exclude_enemy_hero_ids"), "11,12");
  assert.equal(calls[1].searchParams.get("hero_id"), null);
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
    query: { corrupted_items: "include" },
    cache: true,
    dedupe: false,
  });

  assert.equal(calls[0].searchParams.get("min_networth"), "1000");
  assert.equal(calls[0].searchParams.get("max_networth"), "5000");
  assert.equal(calls[1].searchParams.get("corrupted_items"), "include");
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

  assert.equal(calls[0].searchParams.get("hero_ids"), "7,8");
  assert.equal(calls[0].searchParams.get("account_ids"), "123,456");
  assert.equal(calls[0].searchParams.get("is_low_pri_pool"), null);

  assert.equal(calls[1].searchParams.get("is_low_pri_pool"), "true");
  assert.equal(calls[1].searchParams.get("min_networth"), null);
  assert.equal(calls[1].searchParams.get("hero_ids"), null);

  assert.equal(calls[2].searchParams.get("match_mode"), "ranked");
  assert.equal(calls[2].searchParams.get("hero_ids"), null);
  assert.equal(calls[2].searchParams.get("min_networth"), null);
  assert.equal(calls[2].searchParams.get("account_ids"), "123,456");

  assert.equal(calls[3].searchParams.get("hero_id"), null);
  assert.equal(calls[3].searchParams.get("min_networth"), null);
});


test("buildItemDetailAnalyticsViewModel composes item performance, combinations and flow", () => {
  const model = buildItemDetailAnalyticsViewModel(
    { id: 101, name: "Test Item", type: "upgrade", images: {}, raw: { item_id: 101 } },
    [
      { itemId: 101, wins: 60, losses: 40, matches: 100, players: 90, avgBuyTimeS: 420, avgSellTimeS: 900, avgBuyTimeRelative: 0.25, avgSellTimeRelative: 0.5 },
      { itemId: 202, wins: 10, losses: 10, matches: 20 },
    ],
    [
      { itemIds: [101, 202], wins: 30, losses: 20, matches: 50 },
      { itemIds: [202, 303], wins: 8, losses: 12, matches: 20 },
    ],
    {
      nodes: [
        { column: 0, itemId: 101, matches: 100 },
        { column: 1, itemId: 101, matches: 40 },
      ],
      edges: [
        { fromItemId: 101, toItemId: 202, matches: 30 },
        { fromItemId: 303, toItemId: 101, matches: 25 },
      ],
    },
  );

  assert.equal(model.performance.winRate, 60);
  assert.equal(model.performance.matches, 100);
  assert.equal(model.permutations.length, 1);
  assert.deepEqual(model.permutations[0].itemIds, [101, 202]);
  assert.deepEqual(model.flowNodes.map(row => row.column), [0, 1]);
  assert.deepEqual(model.flowEdges.map(row => row.direction), ["out", "in"]);
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
  assert.equal(calls[1].searchParams.get("item_ids"), "101,202");
  assert.equal(calls[2].searchParams.get("locked_item_ids"), "101,202");
  assert.equal(calls[2].searchParams.get("locked_columns"), "0,1");

  const item = normalizeItemStats({ data: [{ item_id: 101, bucket: 0, wins: 60, losses: 40, matches: 100, players: 100, avg_buy_time_s: 420, avg_sell_time_s: 900, avg_buy_time_relative: 0.25, avg_sell_time_relative: 0.5, future_metric: true }] });
  const permutation = normalizeItemPermutationStats({ data: [{ item_ids: [101, 202], wins: 30, losses: 20, matches: 50, future_metric: true }] });
  const flow = normalizeItemFlowStats({ data: { nodes: [{ column: 0, item_id: 101, wins: 60, losses: 40, matches: 100, players: 100, total_kills: 500, total_deaths: 400, total_assists: 800, adjusted_win_rate: 0.58, avg_net_worth_at_buy: 3200, future_metric: true }], edges: [{ from_column: 0, from_item_id: 101, to_item_id: 202, wins: 20, losses: 10, matches: 30 }], summary: { wins: 60, losses: 40, matches: 100, players: 100, total_kills: 500, total_deaths: 400, total_assists: 800, avg_net_worth: 15000, avg_duration_s: 1500 }, baseline: { matches: 120 }, reached_per_column: [120, 80] } });

  assert.equal(item[0].avgBuyTimeS, 420);
  assert.equal(item[0].raw.future_metric, true);
  assert.deepEqual(permutation[0].itemIds, [101, 202]);
  assert.equal(flow.nodes[0].adjustedWinRate, 0.58);
  assert.deepEqual(flow.reachedPerColumn, [120, 80]);
});


test("advanced analytics wrappers use current API paths and filters", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async input => {
    calls.push(new URL(input));
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  });

  await getLaneMatchupStats({ hero_ids: [1, 2], enemy_hero_ids: [3, 4], assigned_lanes: ["lane_a", "lane_b"], stats: ["kills", "denies"], cache: false, dedupe: false });
  await getLaneSoulCurve({ hero_ids: [1, 2], group_by: ["assigned_lane", "hero_ids"], cache: false, dedupe: false });
  await getPlayerPerformanceCurve({ resolution: 0, account_ids: [10, 20], include_item_ids: [30, 40], cache: false, dedupe: false });
  await getPlayerStatsMetrics({ hero_ids: [1, 2], max_matches: 100, include_buff_metrics: true, cache: false, dedupe: false });
  await getHeroScoreboard({ sort_by: "wins", sort_direction: "desc", account_ids: [10, 20], cache: false, dedupe: false });
  await getPlayerScoreboard({ sort_by: "kills", start: 10, limit: 50, cache: false, dedupe: false });
  await getKillDeathStats({ team: 1, account_ids: [10, 20], min_kills_per_raster: 2, cache: false, dedupe: false });

  assert.equal(calls[0].pathname, "/v1/analytics/lane-matchup-stats");
  assert.equal(calls[0].searchParams.get("hero_ids"), "1,2");
  assert.equal(calls[0].searchParams.get("enemy_hero_ids"), "3,4");
  assert.equal(calls[0].searchParams.get("assigned_lanes"), "lane_a,lane_b");
  assert.equal(calls[0].searchParams.get("stats"), "kills,denies");
  assert.equal(calls[1].pathname, "/v1/analytics/lane-soul-curve");
  assert.equal(calls[1].searchParams.get("group_by"), "assigned_lane,hero_ids");
  assert.equal(calls[2].pathname, "/v1/analytics/player-performance-curve");
  assert.equal(calls[2].searchParams.get("account_ids"), "10,20");
  assert.equal(calls[2].searchParams.get("include_item_ids"), "30,40");
  assert.equal(calls[3].pathname, "/v1/analytics/player-stats/metrics");
  assert.equal(calls[3].searchParams.get("include_buff_metrics"), "true");
  assert.equal(calls[4].pathname, "/v1/analytics/scoreboards/heroes");
  assert.equal(calls[4].searchParams.get("sort_by"), "wins");
  assert.equal(calls[5].pathname, "/v1/analytics/scoreboards/players");
  assert.equal(calls[5].searchParams.get("limit"), "50");
  assert.equal(calls[6].pathname, "/v1/analytics/kill-death-stats");
  assert.deepEqual(calls[6].searchParams.getAll("account_ids"), ["10", "20"]);
});


test("advanced analytics normalizers preserve documented response shapes", () => {
  const performance = normalizePlayerPerformanceCurve({ data: [{ game_time: 10, net_worth_avg: 100, permanent_buffs_avg: null, gold_player_avg: 4 }] });
  assert.deepEqual(performance[0], { gameTime: 10, netWorthAvg: 100, netWorthStd: null, killsAvg: null, killsStd: null, deathsAvg: null, deathsStd: null, assistsAvg: null, assistsStd: null, goldPlayerAvg: 4, goldPlayerOrbsAvg: null, goldLaneCreepAvg: null, goldLaneCreepOrbsAvg: null, goldNeutralCreepAvg: null, goldNeutralCreepOrbsAvg: null, goldBossAvg: null, goldBossOrbAvg: null, goldTreasureAvg: null, goldDeniedAvg: null, goldDeathLossAvg: null, goldAssistsAvg: null, goldTeamBonusAvg: null, goldBreakableAvg: null, goldAbilityAssassinateAvg: null, goldItemTrophyCollectorAvg: null, goldItemCultistSacrificeAvg: null, goldItemGooseEggAvg: null, permanentBuffsAvg: null, raw: { game_time: 10, net_worth_avg: 100, permanent_buffs_avg: null, gold_player_avg: 4 } });

  assert.deepEqual(normalizeHeroScoreboard({ data: [{ rank: 1, hero_id: 7, value: 12.5, matches: 20 }] })[0], { rank: 1, heroId: 7, value: 12.5, matches: 20, raw: { rank: 1, hero_id: 7, value: 12.5, matches: 20 } });
  assert.deepEqual(normalizePlayerScoreboard({ data: [{ rank: 1, account_id: 42, value: 900, matches: 20, badge: 90, badge_progress: 500 }] })[0], { rank: 1, accountId: 42, value: 900, matches: 20, badge: 90, badgeProgress: 500, raw: { rank: 1, account_id: 42, value: 900, matches: 20, badge: 90, badge_progress: 500 } });
  assert.deepEqual(normalizeKillDeathStats({ data: [{ position_x: 1, position_y: 2, killer_team: 0, deaths: 3, kills: 4 }] })[0], { positionX: 1, positionY: 2, killerTeam: 0, deaths: 3, kills: 4, raw: { position_x: 1, position_y: 2, killer_team: 0, deaths: 3, kills: 4 } });
  assert.deepEqual(normalizeLaneMatchupStats({ data: [{ assigned_lane: 1, hero_ids: [7, 8], enemy_hero_ids: [9, 10], wins: 5, matches_played: 10, sample_time_s: 900, net_worth_diff: 100, sample_matches: 8, stats: { kills: { value: 3 } } }] })[0].heroIds, [7, 8]);
  const laneSoul = normalizeLaneSoulCurve({ data: [{ assigned_lane: 1, hero_ids: [], enemy_hero_ids: [], sample_times_s: [180], sample_matches: [10], matches_played: 12, net_worth_diff: [50], net_worth_diff_std: [20], stats: { kills: { value: [2], value_std: [1], diff: [1], diff_std: [0.5] } } }] });
  assert.deepEqual(laneSoul[0].sampleTimesS, [180]);
  const metrics = normalizePlayerStatsMetrics({ data: { "42": { kills: { avg: 3 } } } });
  assert.deepEqual(metrics.data, { "42": { kills: { avg: 3 } } });
});

test("lane analytics wrappers reject filters that belong to the other lane endpoint", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async input => {
    calls.push(new URL(input));
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  });
  await getLaneMatchupStats({ min_time_s: 10, sample_time_s: 900, cache: false, dedupe: false });
  await getLaneSoulCurve({ min_time_s: 180, sample_time_s: 900, cache: false, dedupe: false });
  assert.equal(calls[0].searchParams.get("sample_time_s"), "900");
  assert.equal(calls[0].searchParams.get("min_time_s"), null);
  assert.equal(calls[1].searchParams.get("min_time_s"), "180");
  assert.equal(calls[1].searchParams.get("sample_time_s"), null);
});
