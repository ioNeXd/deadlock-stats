import test from "node:test";
import assert from "node:assert/strict";

import { createVersionMonitor } from "../src/services/versioning.js";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("version monitor compares successive OpenAPI snapshots", async () => {
  const contracts = [
    {
      paths: {
        "/v1/patches": { get: { deprecated: false } },
        "/v1/assets/heroes": { get: {} },
      },
    },
    {
      paths: {
        "/v1/patches": { get: { deprecated: true } },
        "/v2/patches": { get: {} },
        "/v1/assets/heroes": { get: {} },
      },
    },
  ];

  let index = 0;
  globalThis.fetch = async () => new Response(JSON.stringify(contracts[index++]), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  const events = [];
  const monitor = createVersionMonitor({
    onVersionDiscovered: event => events.push(event),
    onEnterLegacy: event => events.push(event),
  });

  const first = await monitor.refresh({ cache: false, dedupe: false });
  assert.deepEqual(first.transition.events, []);

  const second = await monitor.refresh({ cache: false, dedupe: false });
  assert.deepEqual(second.transition.events, [
    {
      type: "version_discovered",
      path: "/v2/patches",
      version: "v2",
    },
    {
      type: "entered_legacy",
      resourcePath: "/patches",
      legacyPath: "/v1/patches",
      legacyVersion: "v1",
      currentPath: "/v2/patches",
      currentVersion: "v2",
      reason: "A newer API version replaced the resource.",
    },
  ]);
  assert.deepEqual(events, second.transition.events);
});
