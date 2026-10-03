import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlayerHeroStats,
  getPlayerRanks,
  getPlayerRankDistribution,
  searchSteamProfiles,
  getPlayerMatchHistory,
  getPlayerRankImage,
  getPlayerMmr,
  getPlayerMmrDistribution,
  getPlayerHeroMmr,
  getPlayerHeroMmrDistribution,
  getPlayerMmrHistory,
  getPlayerHeroMmrHistory,
  getPlayerRankPredict,
  getPlayerRankPredictImage,
  getPlayerRankPredictBatchImage,
} from "../src/api/players.js";

test("player hero stats requires account ids and forwards documented filters", async () => {
  assert.throws(() => getPlayerHeroStats(), TypeError);
  assert.throws(() => getPlayerHeroStats({ account_ids: [] }), RangeError);
  assert.throws(() => getPlayerHeroStats({ account_ids: new Array(1001).fill(1) }), RangeError);
  assert.throws(() => getPlayerHeroStats({ account_ids: [-1] }), RangeError);
  assert.throws(() => getPlayerRanks([1, 1.5]), RangeError);

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(new URL(url));
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    await getPlayerHeroStats({
      account_ids: [10, 20],
      game_mode: "normal",
      hero_ids: "1,2",
      unsupported: "drop",
    });
    assert.equal(calls[0].pathname, "/v1/players/hero-stats");
    assert.equal(calls[0].searchParams.get("account_ids"), "10,20");
    assert.equal(calls[0].searchParams.get("hero_ids"), "1,2");
    assert.equal(calls[0].searchParams.has("unsupported"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("batch player ranks and Steam search use current documented endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(new URL(url));
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    assert.throws(() => searchSteamProfiles(""), TypeError);
    assert.throws(() => searchSteamProfiles("detective", { limit: 0 }), RangeError);
    assert.throws(() => searchSteamProfiles("detective", { limit: 1001 }), RangeError);
    assert.throws(() => searchSteamProfiles("detective", { min_matches_played_last_30d: -1 }), RangeError);
    assert.throws(() => searchSteamProfiles("detective", { min_last_team_avg_badge: -1 }), RangeError);
    assert.throws(() => searchSteamProfiles("detective", { matches_played_weight: -0.1 }), RangeError);
    await getPlayerRanks([1, 2]);
    await searchSteamProfiles("detective", { limit: 25, unsupported: "drop" });
    assert.equal(calls[0].pathname, "/v1/players/rank");
    assert.equal(calls[0].searchParams.get("account_ids"), "1,2");
    assert.equal(calls[1].pathname, "/v1/players/steam-search");
    assert.equal(calls[1].searchParams.get("search_query"), "detective");
    assert.equal(calls[1].searchParams.get("limit"), "25");
    assert.equal(calls[1].searchParams.has("unsupported"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rank distribution forwards only documented filters", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(new URL(url));
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    await getPlayerRankDistribution({
      min_unix_timestamp: 10,
      is_new_player_pool: true,
      unsupported: "drop",
    });
    assert.equal(calls[0].pathname, "/v1/players/rank/distribution");
    assert.equal(calls[0].searchParams.get("min_unix_timestamp"), "10");
    assert.equal(calls[0].searchParams.get("is_new_player_pool"), "true");
    assert.equal(calls[0].searchParams.has("unsupported"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("player match history preserves force_refetch and rank images stay binary", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(new URL(url));
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/webp" },
    });
  };
  try {
    assert.throws(() => getPlayerMatchHistory(-1), RangeError);
    await getPlayerMatchHistory(123, { force_refetch: true });
    await getPlayerRankImage([123, 456], "webp");
    await getPlayerRankImage([123]);
    assert.throws(() => getPlayerRankImage([123], "jpg"), RangeError);
    assert.equal(calls[0].searchParams.get("force_refetch"), "true");
    assert.equal(calls[1].pathname, "/v1/players/rank/image");
    assert.equal(calls[1].searchParams.get("account_ids"), "123,456");
    assert.equal(calls[1].searchParams.get("format"), "webp");
    assert.equal(calls[2].searchParams.get("format"), "png");
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("player MMR and rank prediction endpoints use current API paths and constraints", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(new URL(url));
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    assert.throws(() => getPlayerMmr([]), RangeError);
    assert.throws(() => getPlayerHeroMmr(-1, [1]), RangeError);
    assert.throws(() => getPlayerRankPredictImage(1, "jpg"), RangeError);
    assert.throws(() => getPlayerRankPredictBatchImage(new Array(13).fill(1)), RangeError);

    await getPlayerMmr([1, 2], { max_match_id: 99 });
    await getPlayerMmrDistribution({ min_match_id: 10 });
    await getPlayerHeroMmr(7, [1, 2], { max_match_id: 99 });
    await getPlayerHeroMmrDistribution(7, { max_match_id: 99 });
    await getPlayerMmrHistory(1);
    await getPlayerHeroMmrHistory(1, 7);
    await getPlayerRankPredict(1);
    await getPlayerRankPredictImage(1, "webp");
    await getPlayerRankPredictBatchImage([1, 2], "png");

    assert.equal(calls[0].pathname, "/v1/players/mmr");
    assert.equal(calls[0].searchParams.get("account_ids"), "1,2");
    assert.equal(calls[0].searchParams.get("max_match_id"), "99");
    assert.equal(calls[1].pathname, "/v1/players/mmr/distribution");
    assert.equal(calls[2].pathname, "/v1/players/mmr/7");
    assert.equal(calls[3].pathname, "/v1/players/mmr/distribution/7");
    assert.equal(calls[4].pathname, "/v1/players/1/mmr-history");
    assert.equal(calls[5].pathname, "/v1/players/1/mmr-history/7");
    assert.equal(calls[6].pathname, "/v1/players/1/rank-predict");
    assert.equal(calls[7].pathname, "/v1/players/1/rank-predict/image");
    assert.equal(calls[7].searchParams.get("format"), "webp");
    assert.equal(calls[8].pathname, "/v1/players/rank-predict/image");
    assert.equal(calls[8].searchParams.get("account_ids"), "1,2");
    assert.equal(calls[8].searchParams.get("format"), "png");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

import { getPlayerDetailSnapshot, buildPlayerDetailViewModel } from "../src/services/players.js";


test("player detail core snapshot requests only current rank", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async input => {
    const url = new URL(input);
    calls.push(url.pathname);
    return new Response(JSON.stringify({ badge: 10, rank: 2, subrank: 3 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const { getPlayerDetailCoreSnapshot } = await import("../src/services/players.js");
    const snapshot = await getPlayerDetailCoreSnapshot(7, { cache: false, dedupe: false });
    assert.deepEqual(calls, ["/v1/players/7/rank"]);
    assert.equal(snapshot.rank.data.badge, 10);
    assert.deepEqual(snapshot.heroStats, []);
    assert.deepEqual(snapshot.matchHistory, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("player detail snapshot composes current API requests", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async input => {
    const url = new URL(input);
    calls.push(url.pathname);
    const payloads = {
      "/v1/players/7/rank": { badge: 10, rank: 2, subrank: 3 },
      "/v1/players/hero-stats": [{ hero_id: 1, matches_played: 12 }],
      "/v1/players/7/match-history": [{ match_id: 99 }],
      "/v1/players/7/enemy-stats": [{ enemy_hero_id: 8, matches_played: 5 }],
      "/v1/players/7/mate-stats": [{ mate_account_id: 9, matches_played: 6 }],
    };
    return new Response(JSON.stringify(payloads[url.pathname] ?? []), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const snapshot = await getPlayerDetailSnapshot(7, { cache: false, dedupe: false });
    assert.deepEqual(new Set(calls), new Set([
      "/v1/players/7/rank",
      "/v1/players/hero-stats",
      "/v1/players/7/match-history",
      "/v1/players/7/enemy-stats",
      "/v1/players/7/mate-stats",
    ]));
    assert.equal(snapshot.rank.data.badge, 10);
    assert.equal(snapshot.heroStats[0].hero_id, 1);
    assert.equal(snapshot.matchHistory[0].match_id, 99);
    assert.equal(snapshot.enemyStats[0].enemy_hero_id, 8);
    assert.equal(snapshot.mateStats[0].mate_account_id, 9);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("player detail snapshot composes rank, heroes, history and relationships", async () => {
  const snapshot = {
    accountId: 7,
    rank: { data: { badge: 10, rank: 2, subrank: 3 } },
    heroStats: { data: [{ hero_id: 2, matches_played: 5 }, { hero_id: 1, matches_played: 20 }] },
    matchHistory: { data: [{ match_id: 99 }] },
    enemyStats: { data: [{ enemy_hero_id: 8, matches_played: 30 }] },
    mateStats: { data: [{ mate_account_id: 9, matches_played: 40 }] },
  };
  const model = buildPlayerDetailViewModel(snapshot);
  assert.equal(model.accountId, 7);
  assert.equal(model.rank.badge, 10);
  assert.deepEqual(model.heroStats.map(row => row.hero_id), [1, 2]);
  assert.equal(model.matchHistory[0].match_id, 99);
  assert.equal(model.enemyStats[0].enemy_hero_id, 8);
  assert.equal(model.mateStats[0].mate_account_id, 9);
});


test("player search resolves numeric account IDs through Steam profile lookup", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async input => {
    const url = new URL(input);
    calls.push(url);
    return new Response(JSON.stringify([{ account_id: 123, personaname: "Detective" }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const { searchPlayers } = await import("../src/services/players.js");
    const result = await searchPlayers("123", { cache: false, dedupe: false });
    assert.equal(result.data[0].account_id, 123);
    assert.equal(calls[0].pathname, "/v1/players/steam");
    assert.equal(calls[0].searchParams.get("account_ids"), "123");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
