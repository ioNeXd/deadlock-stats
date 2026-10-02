import assert from "node:assert/strict";
import test from "node:test";

import { searchBuilds } from "../src/api/builds.js";
import { getBuild } from "../src/services/builds.js";

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

test("getBuild preserves the documented single-build object response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ hero_build_id: 1234, hero_id: 7 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  try {
    const result = await getBuild(7, 1234);
    assert.deepEqual(result.data, { hero_build_id: 1234, hero_id: 7 });
    assert.deepEqual(result.raw, result.data);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("normalizeBuildDetail preserves build metadata and mod categories", async () => {
  const { normalizeBuildDetail } = await import("../src/services/builds.js");
  const result = normalizeBuildDetail({
    hero_build: {
      hero_build_id: 42,
      hero_id: 7,
      author_account_id: 123,
      name: "Test build",
      language: 0,
      version: 3,
      origin_build_id: 41,
      details: {
        mod_categories: [{
          name: "Weapon",
          optional: false,
          mods: [{ ability_id: 9001, annotation: "Core" }],
        }],
      },
    },
  });
  assert.equal(result.heroBuildId, 42);
  assert.equal(result.heroId, 7);
  assert.equal(result.categories[0].name, "Weapon");
  assert.equal(result.categories[0].mods[0].abilityId, 9001);
  assert.equal(result.categories[0].mods[0].annotation, "Core");
});
