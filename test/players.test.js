import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlayerHeroStats,
  getPlayerRanks,
  getPlayerRankDistribution,
  searchSteamProfiles,
  getPlayerMatchHistory,
  getPlayerRankImage,
} from "../src/api/players.js";

test("player hero stats requires account ids and forwards documented filters", async () => {
  assert.throws(() => getPlayerHeroStats(), TypeError);

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
    await getPlayerMatchHistory(123, { force_refetch: true });
    await getPlayerRankImage([123, 456], "webp");
    assert.equal(calls[0].searchParams.get("force_refetch"), "true");
    assert.equal(calls[1].pathname, "/v1/players/rank/image");
    assert.equal(calls[1].searchParams.get("account_ids"), "123,456");
    assert.equal(calls[1].searchParams.get("format"), "webp");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
