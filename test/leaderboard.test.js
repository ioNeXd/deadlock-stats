import assert from "node:assert/strict";
import test from "node:test";

import { getLeaderboard } from "../src/api/leaderboard.js";

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
  } finally {
    globalThis.fetch = originalFetch;
  }
});
