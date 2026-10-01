import test from "node:test";
import assert from "node:assert/strict";

import { getApiHealth, getApiInfo, probeApiStatus } from "../src/services/api-status.js";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("getApiHealth uses the documented health endpoint", async () => {
  let request;
  globalThis.fetch = async (input) => {
    request = String(input);
    return new Response(JSON.stringify({
      services: { clickhouse: true, postgres: true, redis: true },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const result = await getApiHealth({ cache: false, dedupe: false });

  assert.equal(new URL(request).pathname, "/v1/info/health");
  assert.deepEqual(result.data.services, {
    clickhouse: true,
    postgres: true,
    redis: true,
  });
});

test("getApiInfo uses the documented API info endpoint", async () => {
  let request;
  globalThis.fetch = async (input) => {
    request = String(input);
    return new Response(JSON.stringify({ fetched_matches_per_day: 42 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const result = await getApiInfo({ cache: false, dedupe: false });

  assert.equal(new URL(request).pathname, "/v1/info");
  assert.equal(result.data.fetched_matches_per_day, 42);
});

test("probeApiStatus returns normalized online status", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    services: { clickhouse: true, postgres: true, redis: false },
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  const result = await probeApiStatus();

  assert.equal(result.online, true);
  assert.equal(result.status, 200);
  assert.equal(result.data.services.redis, false);
});

test("probeApiStatus converts API failures into an offline result", async () => {
  globalThis.fetch = async () => new Response("unavailable", {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "content-type": "text/plain", "retry-after": "5" },
  });

  const result = await probeApiStatus({ retries: 0 });

  assert.equal(result.online, false);
  assert.equal(result.status, 503);
  assert.equal(result.error.status, 503);
  assert.equal(result.error.retryAfterMs, 5000);
});
