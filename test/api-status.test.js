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
  assert.equal(result.healthy, false);
  assert.deepEqual(result.services, { clickhouse: true, postgres: true, redis: false });
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


test("probeApiStatus always bypasses cache and dedupe", async () => {
  const requests = [];
  globalThis.fetch = async (input, init = {}) => {
    requests.push({ input: String(input), init });
    return new Response(JSON.stringify({
      services: { clickhouse: true, postgres: true, redis: true },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  await probeApiStatus({ cache: true, dedupe: true });
  await probeApiStatus({ cache: true, dedupe: true });

  assert.equal(requests.length, 4);
});


test("probeApiStatus treats incomplete health payloads as unknown", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    services: { clickhouse: true, postgres: true },
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  const result = await probeApiStatus();

  assert.equal(result.online, true);
  assert.equal(result.healthy, null);
});


test("probeApiStatus includes API info without making it a health dependency", async () => {
  const requests = [];
  globalThis.fetch = async input => {
    const pathname = new URL(String(input)).pathname;
    requests.push(pathname);
    if (pathname === "/v1/info/health") {
      return new Response(JSON.stringify({
        services: { clickhouse: true, postgres: true, redis: true },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      fetched_matches_per_day: 123,
      table_sizes: { matches: { rows: 456, is_view: false } },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const result = await probeApiStatus();

  assert.deepEqual(requests.sort(), ["/v1/info", "/v1/info/health"]);
  assert.equal(result.online, true);
  assert.equal(result.healthy, true);
  assert.equal(result.info.fetched_matches_per_day, 123);
  assert.equal(result.info.table_sizes.matches.rows, 456);
  assert.equal(result.infoStatus, 200);
});

test("probeApiStatus preserves health status when optional API info fails", async () => {
  globalThis.fetch = async input => {
    const pathname = new URL(String(input)).pathname;
    if (pathname === "/v1/info/health") {
      return new Response(JSON.stringify({
        services: { clickhouse: true, postgres: true, redis: true },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("info unavailable", {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "content-type": "text/plain" },
    });
  };

  const result = await probeApiStatus({ retries: 0 });

  assert.equal(result.online, true);
  assert.equal(result.healthy, true);
  assert.equal(result.info, null);
  assert.equal(result.infoError.status, 503);
});


test("probeApiStatus exposes standard rate limit headers", async () => {
  globalThis.fetch = async input => {
    const pathname = new URL(String(input)).pathname;
    if (pathname === "/v1/info/health") {
      return new Response(JSON.stringify({ services: { clickhouse: true, postgres: true, redis: true } }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-ratelimit-limit": "120",
          "x-ratelimit-remaining": "117",
          "x-ratelimit-reset": "60",
        },
      });
    }
    return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
  };

  const result = await probeApiStatus({ retries: 0 });
  assert.deepEqual(result.rateLimit, {
    "x-ratelimit-limit": "120",
    "x-ratelimit-remaining": "117",
    "x-ratelimit-reset": "60",
  });
});
