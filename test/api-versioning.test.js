import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVersionPolicy,
  detectApiVersions,
  reconcileVersionPolicy,
} from "../src/api/versioning.js";

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

test("buildVersionPolicy identifies a v1 resource replaced by v2", () => {
  const events = [];
  const policy = buildVersionPolicy(
    { paths: { "/v1/patches": {}, "/v1/assets/heroes": {}, "/v2/patches": {} } },
    event => events.push(event),
  );

  assert.deepEqual(policy.legacy, [{
    type: "legacy",
    path: "/v1/patches",
    version: "v1",
    currentPath: "/v2/patches",
    currentVersion: "v2",
    reason: "A newer API version exists for the same resource path.",
  }]);
  assert.deepEqual(events, policy.legacy);
});

test("buildVersionPolicy treats explicitly deprecated OpenAPI operations as legacy", () => {
  const events = [];
  const policy = buildVersionPolicy(
    {
      paths: {
        "/v1/patches": {
          get: { deprecated: true },
        },
      },
    },
    event => events.push(event),
  );

  assert.deepEqual(policy.legacy, [{
    type: "legacy",
    path: "/v1/patches",
    version: "v1",
    currentPath: null,
    currentVersion: null,
    reason: "The OpenAPI contract marks this operation as deprecated.",
  }]);
  assert.deepEqual(events, policy.legacy);
});

test("reconcileVersionPolicy reports discovered paths and legacy transitions", () => {
  const events = [];
  const previous = {
    paths: {
      "/v1/patches": {},
      "/v1/assets/heroes": {},
    },
  };
  const next = {
    paths: {
      "/v1/patches": {},
      "/v2/patches": {},
      "/v1/assets/heroes": {},
      "/v1/items": {},
    },
  };

  const result = reconcileVersionPolicy(previous, next, {
    onVersionDiscovered: event => events.push(event),
    onEnterLegacy: event => events.push(event),
  });

  assert.deepEqual(result.events, [
    {
      type: "version_discovered",
      path: "/v2/patches",
      version: "v2",
    },
    {
      type: "version_discovered",
      path: "/v1/items",
      version: "v1",
    },
    {
      type: "entered_legacy",
      resourcePath: "/patches/",
      legacyPath: "/v1/patches",
      legacyVersion: "v1",
      currentPath: "/v2/patches",
      currentVersion: "v2",
    },
  ]);
  assert.deepEqual(events, result.events);
});


test("reconcileVersionPolicy reports an explicit deprecation transition", () => {
  const events = [];
  const previous = {
    paths: {
      "/v1/patches": {
        get: { deprecated: false },
      },
    },
  };
  const next = {
    paths: {
      "/v1/patches": {
        get: { deprecated: true },
      },
    },
  };

  const result = reconcileVersionPolicy(previous, next, {
    onEnterLegacy: event => events.push(event),
  });

  assert.deepEqual(result.events, [{
    type: "entered_legacy",
    resourcePath: "/patches/",
    legacyPath: "/v1/patches",
    legacyVersion: "v1",
    currentPath: null,
    currentVersion: null,
    reason: "The OpenAPI contract marked the resource as deprecated.",
  }]);
  assert.deepEqual(events, result.events);
});
