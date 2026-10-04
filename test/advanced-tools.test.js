import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDemoStatus,
  normalizeLiveUrls,
  buildDemoQueryBody,
  buildCustomMatchBody,
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

test("advanced tools build custom match body without empty values", () => {
  assert.deepEqual(buildCustomMatchBody({
    game_mode: "normal",
    callback_url: "",
    cheats_enabled: false,
    randomize_lanes: null,
    min_roster_size: 0,
  }), {
    game_mode: "normal",
    cheats_enabled: false,
    min_roster_size: 0,
  });
});


test("advanced tools UI presents demo schema table summaries", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../src/advanced-tools-ui.js", import.meta.url), "utf8");
  assert.match(source, /normalizeDemoSchema/);
  assert.match(source, /columns\.length/);
  assert.match(source, /arrowType/);
});
