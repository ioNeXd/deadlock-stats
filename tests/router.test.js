import test from "node:test";
import assert from "node:assert/strict";
import { parseHeroIdFromHash } from "../js/router.js";

// --- parseHeroIdFromHash ---

test("parseHeroIdFromHash extracts valid hero ID from hash", () => {
  assert.equal(parseHeroIdFromHash("#hero=123"), 123);
  assert.equal(parseHeroIdFromHash("hero=42"), 42);
  assert.equal(parseHeroIdFromHash("#hero=1"), 1);
});

test("parseHeroIdFromHash returns null for empty or missing hash", () => {
  assert.equal(parseHeroIdFromHash(""), null);
  assert.equal(parseHeroIdFromHash("#"), null);
  assert.equal(parseHeroIdFromHash(null), null);
  assert.equal(parseHeroIdFromHash(undefined), null);
});

test("parseHeroIdFromHash returns null for non-numeric hero ID", () => {
  assert.equal(parseHeroIdFromHash("#hero=abc"), null);
  assert.equal(parseHeroIdFromHash("#hero=NaN"), null);
});

test("parseHeroIdFromHash returns null for zero or negative hero ID", () => {
  assert.equal(parseHeroIdFromHash("#hero=0"), null);
  assert.equal(parseHeroIdFromHash("#hero=-5"), null);
});

test("parseHeroIdFromHash returns null for float hero ID", () => {
  assert.equal(parseHeroIdFromHash("#hero=1.5"), null);
});

test("parseHeroIdFromHash handles hash without hero param", () => {
  assert.equal(parseHeroIdFromHash("#other=value"), null);
  assert.equal(parseHeroIdFromHash("hero="), null);
});
