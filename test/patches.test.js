import test from "node:test";
import assert from "node:assert/strict";
import { buildPatchHistoryViewModel, normalizePatch } from "../src/services/patches.js";

test("normalizes patch feed fields while preserving raw data", () => {
  const raw = {
    title: "Patch 1",
    pub_date: "2026-10-03T00:00:00Z",
    link: "https://example.com/patch",
    guid: { text: "patch-1", is_perma_link: false },
    category: { domain: "game", text: "Gameplay" },
    dc_creator: "Deadlock",
    content_encoded: "<p>Notes</p>",
    slash_comments: "0",
    future_field: "kept in raw",
  };

  const patch = normalizePatch(raw);
  assert.equal(patch.title, "Patch 1");
  assert.equal(patch.category, "Gameplay");
  assert.equal(patch.guid, "patch-1");
  assert.equal(patch.creator, "Deadlock");
  assert.equal(patch.source, null);
  assert.equal(patch.raw.future_field, "kept in raw");
});

test("builds newest-first patch history from array and data envelopes", () => {
  const input = {
    data: [
      { title: "Old", pub_date: "2026-01-01T00:00:00Z" },
      { title: "New", pub_date: "2026-10-03T00:00:00Z" },
      { title: "No date" },
    ],
  };

  const model = buildPatchHistoryViewModel(input);
  assert.equal(model.total, 3);
  assert.equal(model.latest.title, "New");
  assert.equal(model.patches[2].title, "No date");
});


test("patch API uses v2 feed and exposes major patch days", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../src/api/patches.js", import.meta.url), "utf8");
  assert.match(source, /apiGet\("\/v2\/patches"/);
  assert.match(source, /apiGet\("\/v1\/patches\/big-days"/);
});

test("patch history preserves unified feed source and isolates cadence failure", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const start = source.indexOf("async function renderPatches(signal");
  const end = source.indexOf("\nfunction renderNotFound", start);
  const route = source.slice(start, end);
  assert.match(route, /Promise\.allSettled\(\[/);
  assert.match(route, /patch\.source/);
  assert.match(route, /Major patch dates/);
});
