import assert from "node:assert/strict";
import test from "node:test";

import { colorToCss, createAssetVersionContext, normalizeColorValue, STORAGE_KEY } from "../src/services/asset-version.js";
import { clearApiCache } from "../src/api/client.js";

test("normalizes client version lists without inventing versions", async () => {
  clearApiCache();
  const storage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const context = createAssetVersionContext({ storage });

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(new URL(url));
    return new Response(JSON.stringify([6711, 6712, 6711, 0]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await context.load();
    assert.deepEqual(result.data, [0, 6711, 6712]);
    assert.equal(calls[0].pathname, "/v1/assets/client-versions");
    assert.deepEqual(context.list(), [0, 6711, 6712]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("selects only API-advertised versions and persists the selection", async () => {
  clearApiCache();
  let stored = null;
  const storage = {
    getItem: () => stored,
    setItem: (_key, value) => { stored = value; },
    removeItem: () => { stored = null; },
  };
  const context = createAssetVersionContext({ storage });
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async url => {
    calls.push(new URL(url));
    return new Response(JSON.stringify([6701, 6712]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await context.load();
    assert.throws(() => context.set(6702), RangeError);
    assert.equal(context.set(6712), 6712);
    assert.equal(stored, "6712");
    assert.equal(context.options().clientVersion, 6712);
    assert.equal(context.options({ language: "english" }).language, "english");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("passes the selected version to the colors endpoint", async () => {
  clearApiCache();
  const storage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const context = createAssetVersionContext({ storage });
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async url => {
    calls.push(new URL(url));
    return new Response(JSON.stringify([6712]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await context.load();
    context.set(6712);
    await context.loadColors();
    assert.equal(calls[1].pathname, "/v1/assets/colors");
    assert.equal(calls[1].searchParams.get("client_version"), "6712");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("normalizes official color channel shapes without changing source values", () => {
  clearApiCache();
  assert.deepEqual(normalizeColorValue([10, 20, 30, 255]), [10, 20, 30, 255]);
  assert.deepEqual(normalizeColorValue({ r: 10, g: 20, b: 30, a: 128 }), [10, 20, 30, 128]);
  assert.equal(colorToCss({ r: 10, g: 20, b: 30, a: 128 }), "rgba(10,20,30,0.5019607843137255)");
  assert.equal(colorToCss("#abc"), "#abc");
  assert.equal(colorToCss("rgb(255,0,0)"), "");
  assert.equal(colorToCss("red;--x:url(javascript:alert(1))"), "");
  assert.equal(STORAGE_KEY, "deadlock-stats:client-version");
});
