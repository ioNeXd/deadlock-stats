import test from "node:test";
import assert from "node:assert/strict";

import { getGameStats, getHeroBanStats, getHeroStats, getHeroCounterStats, getHeroSynergyStats, getHeroCombStats, getHeroBuildStats, getAbilityOrderStats, getBadgeDistribution, getBuffStats, getBuildItemStats } from "../src/api/analytics.js";
import { normalizeGameStats, normalizeHeroBanStats, normalizeHeroStats } from "../src/services/analytics.js";
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

  await getHeroStats({ bucket: "start_time_day", query: { min_matches: 20 }, cache: false, dedupe: false });
  await getHeroCounterStats({ query: { same_lane_filter: true }, cache: false, dedupe: false });
  await getHeroSynergyStats({ query: { min_matches: 20 }, cache: false, dedupe: false });
  await getHeroCombStats({ query: { comb_size: 6 }, cache: false, dedupe: false });
  await getHeroBuildStats(7, { query: { min_matches: 20 }, cache: false, dedupe: false });
  await getAbilityOrderStats({ query: { hero_id: 7 }, cache: false, dedupe: false });
  await getBadgeDistribution({ cache: false, dedupe: false });
  await getBuffStats({ cache: false, dedupe: false });
  await getBuildItemStats({ query: { hero_id: 7 }, cache: false, dedupe: false });

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
  assert.equal(calls[0].searchParams.get("min_matches"), "20");
  assert.equal(calls[4].searchParams.get("min_matches"), "20");
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
