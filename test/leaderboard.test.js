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
