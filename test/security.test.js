import test from "node:test";
import assert from "node:assert/strict";

import { safeExternalUrl } from "../src/ui/security.js";

test("safeExternalUrl accepts http and https links", () => {
  assert.equal(safeExternalUrl("https://forums.playdeadlock.com/threads/example"), "https://forums.playdeadlock.com/threads/example");
  assert.equal(safeExternalUrl("http://example.com/path"), "http://example.com/path");
});

test("safeExternalUrl rejects unsafe or malformed links", () => {
  assert.equal(safeExternalUrl("javascript:alert(1)"), "");
  assert.equal(safeExternalUrl("data:text/html,<script>alert(1)</script>"), "");
  assert.equal(safeExternalUrl("not a url"), "");
  assert.equal(safeExternalUrl(""), "");
  assert.equal(safeExternalUrl(null), "");
});
