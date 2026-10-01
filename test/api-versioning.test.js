import test from "node:test";
import assert from "node:assert/strict";

import { buildVersionPolicy, detectApiVersions } from "../src/api/versioning.js";

test("detectApiVersions finds API versions from OpenAPI paths", () => {
  assert.deepEqual(
    detectApiVersions({
      paths: {
        "/v1/assets/heroes": {},
        "/v1/matches": {},
        "/v2/assets/heroes": {},
        "/internal/status": {},
      },
    }),
    [1, 2],
  );
});

test("v1 becomes legacy only when a newer version exists", () => {
  const events = [];
  const policy = buildVersionPolicy(
    { paths: { "/v1/assets/heroes": {}, "/v1/items": {} } },
    event => events.push(event),
  );

  assert.equal(policy.currentVersion, "v1");
  assert.deepEqual(policy.legacyVersions, []);
  assert.deepEqual(events, []);
});

test("legacy callback is triggered for v1 when v2 appears", () => {
  const events = [];
  const policy = buildVersionPolicy(
    { paths: { "/v1/assets/heroes": {}, "/v2/assets/heroes": {} } },
    event => events.push(event),
  );

  assert.equal(policy.currentVersion, "v2");
  assert.deepEqual(policy.legacyVersions, ["v1"]);
  assert.deepEqual(events, [
    {
      version: "v1",
      currentVersion: "v2",
      reason: "A newer API version (v2) is present in the OpenAPI contract.",
    },
  ]);
});
