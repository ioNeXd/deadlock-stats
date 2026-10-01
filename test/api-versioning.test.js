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

test("v1 stays current when no matching v2 resource exists", () => {
  const events = [];
  const policy = buildVersionPolicy(
    { paths: { "/v1/assets/heroes": {}, "/v2/patches": {} } },
    event => events.push(event),
  );

  assert.deepEqual(policy.current, [
    { path: "/v1/assets/heroes", version: "v1" },
    { path: "/v2/patches", version: "v2" },
  ]);
  assert.deepEqual(policy.legacy, []);
  assert.deepEqual(events, []);
});

test("legacy callback is triggered only for the matching v1 resource", () => {
  const events = [];
  const policy = buildVersionPolicy(
    { paths: { "/v1/patches": {}, "/v1/assets/heroes": {}, "/v2/patches": {} } },
    event => events.push(event),
  );

  assert.deepEqual(policy.legacy, [
    {
      path: "/v1/patches",
      version: "v1",
      currentPath: "/v2/patches",
      currentVersion: "v2",
      reason: "A newer API version exists for the same resource path.",
    },
  ]);
  assert.deepEqual(events, policy.legacy);
  assert.deepEqual(policy.current, [
    { path: "/v1/assets/heroes", version: "v1" },
    { path: "/v2/patches", version: "v2" },
  ]);
});
