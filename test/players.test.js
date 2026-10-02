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
