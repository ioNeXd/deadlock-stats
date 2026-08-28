// =============================================================================
// UNIT TESTS — js/utils.js
// Uses Node's built-in test runner (node:test), no external dependencies.
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";

import {
  debounce,
  escapeHtml,
  formatDate,
  isValidHeroId,
  safeGet,
  TTLCache,
} from "../js/utils.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// -----------------------------------------------------------------------------
// escapeHtml
// -----------------------------------------------------------------------------

test("escapeHtml escapes all HTML special characters", () => {
  const input = `<img src=x onerror=alert(1)> & "q" 's'`;
  assert.equal(
    escapeHtml(input),
    "&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot; &#039;s&#039;",
  );
});

test("escapeHtml coerces non-string values", () => {
  assert.equal(escapeHtml(42), "42");
  assert.equal(escapeHtml(null), "null");
  assert.equal(escapeHtml(""), "");
});

// -----------------------------------------------------------------------------
// safeGet
// -----------------------------------------------------------------------------

test("safeGet resolves nested paths and falls back to default", () => {
  const obj = { a: { b: { c: 42 } }, list: [1, 2, 3] };
  assert.equal(safeGet(obj, "a.b.c"), 42);
  assert.equal(safeGet(obj, ["a", "b", "c"]), 42);
  assert.equal(safeGet(obj, "a.b.missing"), null);
  assert.equal(safeGet(obj, "a.b.missing", "dflt"), "dflt");
  assert.equal(safeGet(null, "a.b"), null);
  assert.equal(safeGet(undefined, "a.b", "dflt"), "dflt");
  assert.equal(safeGet(obj, "list.1"), 2);
});

// -----------------------------------------------------------------------------
// isValidHeroId
// -----------------------------------------------------------------------------

test("isValidHeroId accepts positive integers only", () => {
  assert.equal(isValidHeroId(1), true);
  assert.equal(isValidHeroId("13"), true);
  assert.equal(isValidHeroId(0), false);
  assert.equal(isValidHeroId(-1), false);
  assert.equal(isValidHeroId(1.5), false);
  assert.equal(isValidHeroId("abc"), false);
  assert.equal(isValidHeroId(NaN), false);
  assert.equal(isValidHeroId(null), false);
});

// -----------------------------------------------------------------------------
// formatDate
// -----------------------------------------------------------------------------

test("formatDate returns a localized date string", () => {
  const out = formatDate(new Date(2026, 7, 15, 14, 30));
  assert.equal(typeof out, "string");
  assert.match(out, /\d{2}\/\d{2}\/\d{4}/);
  assert.ok(out.length > 0);
});

// -----------------------------------------------------------------------------
// debounce
// -----------------------------------------------------------------------------

test("debounce fires once after a burst of calls with the last arguments", async () => {
  let calls = [];
  const debounced = debounce((...args) => calls.push(args), 40);

  debounced(1);
  debounced(2);
  debounced(3);
  assert.equal(calls.length, 0, "should not fire before the wait elapses");

  await wait(90);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [3]);
});

// -----------------------------------------------------------------------------
// TTLCache
// -----------------------------------------------------------------------------

test("TTLCache stores, reads and removes entries", () => {
  const cache = new TTLCache(60_000);
  cache.set("a", 1);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.has("a"), true);
  assert.equal(cache.has("missing"), false);

  cache.delete("a");
  assert.equal(cache.get("a"), undefined);

  cache.set("b", 2);
  cache.clear();
  assert.equal(cache.get("b"), undefined);
});

test("TTLCache expires entries after the TTL elapses", async () => {
  const cache = new TTLCache(15);
  cache.set("k", "v");
  assert.equal(cache.get("k"), "v");

  await wait(50);
  assert.equal(cache.get("k"), undefined);
  assert.equal(cache.has("k"), false);
});
