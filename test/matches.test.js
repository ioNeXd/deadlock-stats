import test from "node:test";
import assert from "node:assert/strict";
import { getActiveMatches, getRecentlyFetchedMatches, getMatchMetadata, getMatchSalts, getBulkMatchMetadata } from "../src/api/matches.js";
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
  await getBulkMatchMetadata({
    match_ids: [123, 456],
    include_player_final_stats: true,
    include_player_stats: false,
    hero_ids: [1, 2],
    include_item_ids: [101, 202],
    extra_match_columns: "team_score",
    extra_player_columns: "stats.player_damage",
    order_by: "start_time",
    order_direction: "desc",
    limit: 2,
    format: "json",
    cache: false,
    dedupe: false,
  });
  assert.deepEqual(calls.map(url => url.pathname), [
    "/v1/matches/active",
    "/v1/matches/recently-fetched",
    "/v1/matches/123/metadata",
    "/v1/matches/123/salts",
    "/v1/matches/metadata",
  ]);
  assert.equal(calls[0].searchParams.get("account_ids"), "7");
  assert.equal(calls[0].searchParams.getAll("account_ids").length, 2);
  assert.deepEqual(calls[4].searchParams.getAll("match_ids"), ["123", "456"]);
  assert.equal(calls[4].searchParams.get("include_player_final_stats"), "true");
  assert.equal(calls[4].searchParams.get("include_player_stats"), "false");
  assert.equal(calls[4].searchParams.get("hero_ids"), "1,2");
  assert.equal(calls[4].searchParams.get("include_item_ids"), "101,202");
  assert.equal(calls[4].searchParams.get("limit"), "2");
  assert.equal(calls[4].searchParams.get("extra_match_columns"), "team_score");
  assert.equal(calls[4].searchParams.get("extra_player_columns"), "stats.player_damage");
  assert.equal(calls[4].searchParams.get("order_by"), "start_time");
  assert.equal(calls[4].searchParams.get("order_direction"), "desc");
  assert.equal(calls[4].searchParams.get("format"), "json");
});

test("match normalizers preserve documented fields and raw data", () => {
  const result = normalizeMatchInfo({ data: [{
    match_id: 123,
    start_time: 1788000000,
    duration_s: 1800,
    match_mode: 1,
    game_mode: 0,
    average_badge: 72,
    winning_team: 1,
    net_worth_team_0: 12000,
    net_worth_team_1: 14000,
    objectives_mask_team0: 3,
    objectives_mask_team1: 7,
    lobby_id: 55,
    spectators: 12,
    open_spectator_slots: 4,
    players: [{ account_id: 7, hero_id: 1 }],
    future_metric: "kept",
  }]});
  assert.equal(result[0].matchId, 123);
  assert.equal(result[0].durationS, 1800);
  assert.equal(result[0].winningTeam, 1);
  assert.equal(result[0].netWorthTeam0, 12000);
  assert.equal(result[0].objectivesMaskTeam1, 7);
  assert.equal(result[0].lobbyId, 55);
  assert.equal(result[0].players.length, 1);
  assert.equal(result[0].raw.future_metric, "kept");
  assert.deepEqual(normalizeMatchMetadata({ match_id: 123, future_metric: true }), { match_id: 123, future_metric: true });
});
