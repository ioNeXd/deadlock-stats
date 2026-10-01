import test from "node:test";
import assert from "node:assert/strict";

import { getGameStats, getHeroBanStats } from "../src/api/analytics.js";
import { normalizeGameStats, normalizeHeroBanStats } from "../src/services/analytics.js";
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
    bans: 5,
    rate: null,
    raw: { hero_id: 7, bans: 5, future_metric: 11 },
  });
});
