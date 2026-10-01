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
      account_id: 11,
      hero_id: 7,
      matches_played: 25,
      last_played: 1788220800,
      time_played: 72000,
      wins: 14,
      ending_level: 10.5,
      kills: 200,
      deaths: 100,
      assists: 300,
      kills_per_min: 0.25,
      networth_per_min: 500,
      accuracy: 0.61,
      crit_shot_rate: 0.12,
      mvp_rank_counts: [3, 4, 5],
      mvp_rated_matches: 20,
      matches: [1001, 1002],
      permanent_buffs: 9,
      permanent_buff_matches: 8,
      permanent_buffs_per_min: 0.08,
      avg_first_permanent_buff_time_s: 900,
      future_metric: "kept",
    }],
  });

  assert.deepEqual(result[0], {
    accountId: 11,
    heroId: 7,
    matchesPlayed: 25,
    lastPlayed: 1788220800,
    timePlayed: 72000,
    wins: 14,
    endingLevel: 10.5,
    kills: 200,
    deaths: 100,
    assists: 300,
    totalPlayerDamage: null,
    totalPlayerDamageTaken: null,
    totalBossDamage: null,
    totalCreepDamage: null,
    totalNeutralDamage: null,
    deniesPerMatch: null,
    killsPerMin: 0.25,
    deathsPerMin: null,
    assistsPerMin: null,
    deniesPerMin: null,
    networthPerMin: 500,
    lastHitsPerMin: null,
    damagePerMin: null,
    damagePerSoul: null,
    damageMitigatedPerMin: null,
    damageTakenPerMin: null,
    damageTakenPerSoul: null,
    creepsPerMin: null,
    objDamagePerMin: null,
    objDamagePerSoul: null,
    accuracy: 0.61,
    critShotRate: 0.12,
    mvpRankCounts: [3, 4, 5],
    mvpRatedMatches: 20,
    matches: [1001, 1002],
    permanentBuffs: 9,
    permanentBuffMatches: 8,
    permanentBuffsPerMin: 0.08,
    avgFirstPermanentBuffTimeS: 900,
    raw: {
      account_id: 11,
      hero_id: 7,
      matches_played: 25,
      last_played: 1788220800,
      time_played: 72000,
      wins: 14,
      ending_level: 10.5,
      kills: 200,
      deaths: 100,
      assists: 300,
      kills_per_min: 0.25,
      networth_per_min: 500,
      accuracy: 0.61,
      crit_shot_rate: 0.12,
      mvp_rank_counts: [3, 4, 5],
      mvp_rated_matches: 20,
      matches: [1001, 1002],
      permanent_buffs: 9,
      permanent_buff_matches: 8,
      permanent_buffs_per_min: 0.08,
      avg_first_permanent_buff_time_s: 900,
      future_metric: "kept",
    },
  });
});
