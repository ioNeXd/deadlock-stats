import test from "node:test";
import assert from "node:assert/strict";
import { apiGet, apiRequest, clearApiCache, invalidateApiCache } from "../src/api/client.js";

const realFetch = globalThis.fetch;

function mockFetch(handler) {
  globalThis.fetch = async (...args) => handler(...args);
}

test.afterEach(() => {
  clearApiCache();
  globalThis.fetch = realFetch;
});

test("apiGet normalizes query parameters and parses JSON", async () => {
  let requestedUrl;
  mockFetch(async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json", "x-test": "yes" },
    });
  });

  const result = await apiGet("/v1/test", {
    query: { b: "two", a: "one", ignored: undefined },
    cache: false,
  });

  assert.equal(requestedUrl, "https://api.deadlock-api.com/v1/test?a=one&b=two");
  assert.deepEqual(result.data, { ok: true });
  assert.equal(result.status, 200);
  assert.equal(result.contentType, "application/json");
  assert.equal(result.headers["x-test"], "yes");
});

test("GET requests are cached and deduplicated", async () => {
  let calls = 0;
  mockFetch(async () => {
    calls += 1;
    await new Promise(resolve => setTimeout(resolve, 5));
    return new Response(JSON.stringify({ calls }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const [first, second] = await Promise.all([
    apiGet("/v1/test"),
    apiGet("/v1/test"),
  ]);

  assert.equal(calls, 1);
  assert.deepEqual(first.data, { calls: 1 });
  assert.deepEqual(second.data, { calls: 1 });

  const third = await apiGet("/v1/test");
  assert.equal(calls, 1);
  assert.deepEqual(third.data, { calls: 1 });
});

test("429 honors Retry-After before retrying", async () => {
  let calls = 0;
  const started = Date.now();

  mockFetch(async () => {
    calls += 1;
    if (calls === 1) {
      return new Response("rate limited", {
        status: 429,
        headers: { "Retry-After": "0.01" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const result = await apiGet("/v1/test", {
    cache: false,
    retries: 1,
  });

  assert.equal(calls, 2);
  assert.deepEqual(result.data, { ok: true });
  assert.ok(Date.now() - started >= 5);
});

test("binary and stream response types are supported", async () => {
  mockFetch(async () => new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { "content-type": "application/octet-stream" },
  }));

  const binary = await apiRequest("/v1/test", {
    responseType: "arrayBuffer",
    cache: false,
  });

  assert.deepEqual([...new Uint8Array(binary.data)], [1, 2, 3]);

  mockFetch(async () => new Response("data: hello\\n\\n", {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  }));

  const stream = await apiRequest("/v1/test", {
    responseType: "stream",
    cache: false,
  });

  assert.ok(stream.data);
  assert.equal(typeof stream.data.getReader, "function");
});


test("case-insensitive GET methods receive cache and dedupe defaults", async () => {
  let calls = 0;
  mockFetch(async () => {
    calls += 1;
    return new Response(JSON.stringify({ calls }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  await apiRequest("/v1/test", { method: "get" });
  await apiRequest("/v1/test", { method: "get" });

  assert.equal(calls, 1);
});

test("binary response requests do not force JSON Accept", async () => {
  let accept;
  mockFetch(async (_url, init) => {
    accept = init.headers.get("Accept");
    return new Response(new Uint8Array([1, 2]), {
      status: 200,
      headers: { "content-type": "image/png" },
    });
  });

  await apiGet("/v1/test", {
    responseType: "blob",
    cache: false,
  });

  assert.equal(accept, "*/*");
});

test("invalidateApiCache can invalidate every query variant for a path", async () => {
  let calls = 0;
  mockFetch(async () => {
    calls += 1;
    return new Response(JSON.stringify({ calls }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  await apiGet("/v1/test", { query: { a: 1 } });
  await apiGet("/v1/test", { query: { a: 2 } });
  assert.equal(calls, 2);

  invalidateApiCache("/v1/test");

  await apiGet("/v1/test", { query: { a: 1 } });
  await apiGet("/v1/test", { query: { a: 2 } });
  assert.equal(calls, 4);
});


test("explicit responseType overrides the server content type", async () => {
  mockFetch(async () => new Response("hello", {
    status: 200,
    headers: { "content-type": "application/octet-stream" },
  }));

  const result = await apiRequest("/v1/test", {
    responseType: "text",
    cache: false,
  });

  assert.equal(result.data, "hello");
});
