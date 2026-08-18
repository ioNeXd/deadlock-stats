// =============================================================================
// UNIT TESTS — js/i18n.js
// Tests pure behavior with empty translation state (no DOM, no network).
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";

import { getLocalText, t } from "../js/i18n.js";

test("t returns the key when no translations are loaded", () => {
  assert.equal(t("some_missing_key"), "some_missing_key");
});

test("t returns empty string for null/undefined keys", () => {
  assert.equal(t(null), "");
  assert.equal(t(undefined), "");
});

test("getLocalText falls back to the provided fallback", () => {
  assert.equal(getLocalText("missing", "Fallback text"), "Fallback text");
  assert.equal(getLocalText("missing", ""), "");
});
