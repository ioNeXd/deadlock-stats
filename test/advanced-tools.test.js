import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDemoStatus,
  normalizeLiveUrls,
  buildDemoQueryBody,
  buildCustomMatchBody,
  buildLiveQueryOptions,
  parseSseEventBlock,
} from "../src/services/advanced-tools.js";

test("advanced tools normalize demo job status", () => {
  const model = normalizeDemoStatus({
    data: {
      job_id: "job-7",
      status: "done",
      match_id: 123,
      format: "parquet",
      estimated_wait_seconds: null,
      result_url: "https://example.test/result",
      error: null,
      future_field: true,
    },
  });
  assert.equal(model.jobId, "job-7");
  assert.equal(model.status, "done");
  assert.equal(model.matchId, 123);
  assert.equal(model.resultUrl, "https://example.test/result");
  assert.equal(model.raw.future_field, true);
});

test("advanced tools normalize live urls and preserve raw rows", () => {
  const model = normalizeLiveUrls({
    data: [{
      match_id: 456,
      lobby_id: 789,
      broadcast_url: "https://example.test/live",
      started_at: 100,
      updated_at: 120,
      future_field: "kept",
    }],
  });
  assert.equal(model.length, 1);
  assert.equal(model[0].matchId, 456);
  assert.equal(model[0].lobbyId, 789);
  assert.equal(model[0].broadcastUrl, "https://example.test/live");
  assert.equal(model[0].raw.future_field, "kept");
});

test("advanced tools build demo query contract", () => {
  assert.deepEqual(buildDemoQueryBody({ matchId: "123", query: "  select 1  ", format: "parquet" }), {
    match_id: 123,
    query: "select 1",
    format: "parquet",
  });
  assert.throws(() => buildDemoQueryBody({ matchId: -1, query: "select 1" }), RangeError);
  assert.throws(() => buildDemoQueryBody({ matchId: 1, query: "   " }), TypeError);
});

test("advanced tools build custom match body against the current API contract", () => {
  assert.deepEqual(buildCustomMatchBody({
    game_mode: "street_brawl",
    server_region: "south_america",
    callback_url: " https://example.test/callback ",
    cheats_enabled: false,
    disable_auto_ready: true,
    duplicate_heroes_enabled: true,
    is_publicly_visible: false,
    randomize_lanes: true,
    min_roster_size: 0,
    corrupted_item_shop_spawn_minutes: 5,
    ignored_future_field: "drop",
  }), {
    game_mode: "street_brawl",
    server_region: "south_america",
    callback_url: "https://example.test/callback",
    cheats_enabled: false,
    disable_auto_ready: true,
    duplicate_heroes_enabled: true,
    is_publicly_visible: false,
    randomize_lanes: true,
    min_roster_size: 0,
    corrupted_item_shop_spawn_minutes: 5,
  });
  assert.throws(() => buildCustomMatchBody({ game_mode: "invalid" }), RangeError);
  assert.throws(() => buildCustomMatchBody({ server_region: "invalid" }), RangeError);
  assert.throws(() => buildCustomMatchBody({ min_roster_size: -1 }), RangeError);
  assert.throws(() => buildCustomMatchBody({ corrupted_item_shop_spawn_minutes: 1.5 }), RangeError);
  assert.throws(() => buildCustomMatchBody({ cheats_enabled: "false" }), TypeError);
});

test("advanced tools UI exposes all CreateCustomRequest controls", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../src/advanced-tools-ui.js", import.meta.url), "utf8");
  for (const field of ["cheats_enabled", "corrupted_item_shop_spawn_minutes", "disable_auto_ready", "duplicate_heroes_enabled", "game_mode", "is_publicly_visible", "min_roster_size", "randomize_lanes", "server_region", "callback_url"]) {
    assert.match(source, new RegExp(field));
  }
});

test("advanced tools UI presents demo schema table summaries", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../src/advanced-tools-ui.js", import.meta.url), "utf8");
  assert.match(source, /normalizeDemoSchema/);
  assert.match(source, /columns\.length/);
  assert.match(source, /arrowType/);
});

test("advanced tools validate live query requirements", () => {
  assert.deepEqual(buildLiveQueryOptions({ query: " select 1 ", matchId: "42" }), { query: "select 1", match_id: 42, broadcast_url: undefined });
  assert.throws(() => buildLiveQueryOptions({ query: "" }), TypeError);
  assert.throws(() => buildLiveQueryOptions({ query: "select 1" }), TypeError);
});

test("advanced tools parse SSE event fields and multiline data", () => {
  const event = parseSseEventBlock("event: message\nid: 7\ndata: {\\"x\\":1}\ndata: next\n");
  assert.equal(event.type, "message");
  assert.equal(event.id, "7");
  assert.equal(event.data, '{"x":1}\nnext');
});
