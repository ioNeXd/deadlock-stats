import assert from "node:assert/strict";
import test from "node:test";

import { searchBuilds } from "../src/api/builds.js";

test("searchBuilds forwards only documented build filters", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => new Response("[]", {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  try {
    await searchBuilds({
      hero_id: 123,
      limit: 20,
      sort_by: "favorites",
      unsupported: "drop-me",
      cacheTtlMs: 1000,
    });
    const calls = [];
    globalThis.fetch = async url => {
      calls.push(new URL(url));
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };
    await searchBuilds({ hero_id: 123, limit: 20, unsupported: "drop-me" });
    assert.equal(calls[0].pathname, "/v1/builds");
    assert.equal(calls[0].searchParams.get("hero_id"), "123");
    assert.equal(calls[0].searchParams.get("limit"), "20");
    assert.equal(calls[0].searchParams.has("unsupported"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
