import test from "node:test";
import assert from "node:assert/strict";
import { getActiveMatches, getRecentlyFetchedMatches, getMatchMetadata, getMatchSalts } from "../src/api/matches.js";
import { normalizeMatchInfo, normalizeMatchMetadata } from "../src/services/matches.js";

test("match wrappers target documented endpoints", async () => {
  const calls = [];
  globalThis.fetch = async input => {
    const url = new URL(input);
    calls.push(url);
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  };
  await getActiveMatches({ query: { account_ids: [7, 8] }, cache: false, dedupe: false });
  await getRecentlyFetchedMatches({ cache: false, dedupe: false });
  await getMatchMetadata(123, { cache: false, dedupe: false });
  await getMatchSalts(123, { cache: false, dedupe: false });
  assert.deepEqual(calls.map(url => url.pathname), [
    "/v1/matches/active",
    "/v1/matches/recently-fetched",
    "/v1/matches/123/metadata",
    "/v1/matches/123/salts",
  ]);
  assert.equal(calls[0].searchParams.get("account_ids"), "7");
  assert.equal(calls[0].searchParams.getAll("account_ids").length, 2);
});

test("match normalizers preserve documented fields and raw data", () => {
  const result = normalizeMatchInfo({ data: [{
    match_id: 123,
    start_time: 1788000000,
    duration_s: 1800,
    match_mode: 1,
    game_mode: 0,
    average_badge: 72,
    players: [{ account_id: 7, hero_id: 1 }],
    future_metric: "kept",
  }]});
  assert.equal(result[0].matchId, 123);
  assert.equal(result[0].durationS, 1800);
  assert.equal(result[0].players.length, 1);
  assert.equal(result[0].raw.future_metric, "kept");
  assert.deepEqual(normalizeMatchMetadata({ match_id: 123, future_metric: true }), { match_id: 123, future_metric: true });
});
