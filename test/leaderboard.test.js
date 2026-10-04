import assert from "node:assert/strict";
import test from "node:test";

import { getLeaderboard, getLeaderboardRaw, getHeroLeaderboard, getHeroLeaderboardRaw } from "../src/api/leaderboard.js";

test("getLeaderboard validates regions and forwards leaderboard id", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(new URL(url));
    return new Response(JSON.stringify({ entries: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await getLeaderboard("Europe", { leaderboard_id: 42 });
    assert.equal(calls[0].pathname, "/v1/leaderboard/Europe");
    assert.equal(calls[0].searchParams.get("leaderboard_id"), "42");
    assert.throws(() => getLeaderboard("Mars"), RangeError);
    await getHeroLeaderboard("Europe", 7, { leaderboard_id: 42 });
    assert.equal(calls[1].pathname, "/v1/leaderboard/Europe/7");
    assert.equal(calls[1].searchParams.get("leaderboard_id"), "42");
    assert.throws(() => getHeroLeaderboard("Europe", -1), RangeError);
    assert.throws(() => getHeroLeaderboard("Europe", 1.5), RangeError);
    await getLeaderboardRaw("Oceania", { leaderboard_id: 9 });
    assert.equal(calls[2].pathname, "/v1/leaderboard/Oceania/raw");
    assert.equal(calls[2].searchParams.get("leaderboard_id"), "9");
    await getHeroLeaderboardRaw("Asia", 8);
    assert.equal(calls[3].pathname, "/v1/leaderboard/Asia/8/raw");
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("leaderboard service preserves normalized entries and raw payload", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ entries: [{ account_name: "Test", rank: 3 }], marker: "raw" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  try {
    const { loadLeaderboard } = await import("../src/services/leaderboard.js");
    const result = await loadLeaderboard("Europe");
    assert.equal(result.data[0].account_name, "Test");
    assert.equal(result.raw.marker, "raw");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("leaderboard UI exposes raw download action", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../src/app-runtime.js", import.meta.url), "utf8");
  const start = source.indexOf("async function renderLeaderboard(signal");
  const end = source.indexOf("\nasync function renderBuilds", start);
  const route = source.slice(start, end);
  assert.match(route, /Download raw/);
  assert.match(route, /downloadHeroLeaderboardRaw/);
  assert.match(route, /downloadLeaderboardRaw/);
  assert.match(route, /application\/octet-stream/);
});
