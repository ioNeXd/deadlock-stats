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

test("caller-owned abort signals do not share deduplicated requests", async () => {
  let calls = 0;
  let resolveFirst;
  mockFetch(async (_url, init) => {
    calls += 1;
    if (calls === 1) {
      await new Promise((resolve, reject) => {
        resolveFirst = resolve;
        init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    }
    return new Response(JSON.stringify({ calls }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const firstController = new AbortController();
  const secondController = new AbortController();
  const first = apiGet("/v1/abort-isolation", {
    signal: firstController.signal,
    cache: false,
  });
  const second = apiGet("/v1/abort-isolation", {
    signal: secondController.signal,
    cache: false,
  });

  firstController.abort();

  await assert.rejects(first, error => error.code === "ABORTED");
  resolveFirst();

  const result = await second;
  assert.equal(calls, 2);
  assert.deepEqual(result.data, { calls: 2 });
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

test("retryable GET server failures include 408 and 500", async () => {
  for (const status of [408, 500]) {
    let calls = 0;
    mockFetch(async () => {
      calls += 1;
      if (calls === 1) return new Response("temporary failure", { status });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await apiGet("/v1/retry-status", {
      retries: 1,
      cache: false,
    });

    assert.deepEqual(result.data, { ok: true });
    assert.equal(calls, 2);
  }
});

test("retryable GET timeouts retry before surfacing timeout", async () => {
  let calls = 0;
  mockFetch(async (_url, init) => {
    calls += 1;
    if (calls === 1) {
      await new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError")), { once: true });
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const result = await apiGet("/v1/timeout-retry", {
    timeoutMs: 5,
    retries: 1,
    cache: false,
  });

  assert.equal(calls, 2);
  assert.deepEqual(result.data, { ok: true });
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

test("one-shot stream responses are never cached or deduplicated", async () => {
  let calls = 0;
  mockFetch(async () => {
    calls += 1;
    return new Response("data: " + calls + "\\n\\n", {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  });

  const first = await apiGet("/v1/stream", { responseType: "stream" });
  const second = await apiGet("/v1/stream", { responseType: "stream" });

  assert.notEqual(first.data, second.data);
  assert.equal(calls, 2);
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


test("response types select matching Accept headers", async () => {
  const accepts = [];
  mockFetch(async (_url, init) => {
    accepts.push(init.headers.get("Accept"));
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  await apiRequest("/v1/json", { responseType: "json", cache: false });
  await apiRequest("/v1/text", { responseType: "text", cache: false });
  await apiRequest("/v1/raw", { responseType: "response", cache: false });

  assert.equal(accepts[0], "application/json");
  assert.equal(accepts[1], "text/plain, text/html, */*;q=0.8");
  assert.equal(accepts[2], "*/*");
});

test("explicit json responseType parses JSON and rejects invalid JSON without retrying", async () => {
  mockFetch(async () => new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "text/plain" },
  }));

  const result = await apiRequest("/v1/json", {
    responseType: "json",
    cache: false,
  });
  assert.deepEqual(result.data, { ok: true });

  let calls = 0;
  mockFetch(async () => {
    calls += 1;
    return new Response("not json", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  });

  await assert.rejects(
    apiRequest("/v1/json-invalid", { responseType: "json", cache: false, retries: 2 }),
    error => error instanceof Error
      && error.name === "ApiError"
      && error.code === "RESPONSE_PARSE_ERROR"
      && error.cause instanceof SyntaxError,
  );
  assert.equal(calls, 1);
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


test("non-idempotent requests are not retried by default", async () => {
  let calls = 0;
  mockFetch(async () => {
    calls += 1;
    return new Response("temporary failure", { status: 503 });
  });

  await assert.rejects(
    apiRequest("/v1/test", { method: "POST", body: { value: 1 }, retries: 2, cache: false }),
    error => error.status === 503,
  );

  assert.equal(calls, 1);
});

test("non-idempotent retries can be explicitly enabled", async () => {
  let calls = 0;
  mockFetch(async () => {
    calls += 1;
    if (calls === 1) return new Response("temporary failure", { status: 503 });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const result = await apiRequest("/v1/test", {
    method: "POST",
    body: { value: 1 },
    retries: 1,
    retryNonIdempotent: true,
    cache: false,
  });

  assert.deepEqual(result.data, { ok: true });
  assert.equal(calls, 2);
});

test("request cache keys normalize object body property order", async () => {
  let calls = 0;
  mockFetch(async () => {
    calls += 1;
    return new Response(JSON.stringify({ calls }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  await apiRequest("/v1/test", {
    method: "POST",
    body: { b: 2, a: 1 },
    cache: true,
  });
  await apiRequest("/v1/test", {
    method: "POST",
    body: { a: 1, b: 2 },
    cache: true,
  });

  assert.equal(calls, 1);
});

test("aborting during retry backoff stops further network attempts", async () => {
  let calls = 0;
  const controller = new AbortController();

  mockFetch(async () => {
    calls += 1;
    controller.abort();
    return new Response("temporary failure", { status: 503 });
  });

  await assert.rejects(
    apiGet("/v1/test", { retries: 2, cache: false, signal: controller.signal }),
    error => error.code === "ABORTED",
  );

  assert.equal(calls, 1);
});



test("authenticated GET requests do not reuse shared cache or in-flight dedupe", async () => {
  clearApiCache();
  let calls = 0;
  globalThis.fetch = async input => {
    calls += 1;
    return new Response(JSON.stringify({ calls }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const first = await apiGet("/v1/test-auth", { apiKey: "key-a" });
  const second = await apiGet("/v1/test-auth", { apiKey: "key-b" });
  assert.equal(calls, 2);
  assert.equal(first.data.calls, 1);
  assert.equal(second.data.calls, 2);
});

test("retry backoff removes its abort listener after resolving", async () => {
  const controller = new AbortController();
  let listeners = 0;
  const originalAdd = controller.signal.addEventListener.bind(controller.signal);
  const originalRemove = controller.signal.removeEventListener.bind(controller.signal);
  controller.signal.addEventListener = (...args) => {
    listeners += 1;
    return originalAdd(...args);
  };
  controller.signal.removeEventListener = (...args) => {
    listeners -= 1;
    return originalRemove(...args);
  };
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? new Response("{}", { status: 503 })
      : new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
  await apiGet("/v1/retry-listener", {
    signal: controller.signal,
    retries: 1,
    cache: false,
    dedupe: false,
  });
  assert.equal(calls, 2);
  assert.equal(listeners, 0);
});


test("GET cache keys isolate response representations", async () => {
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls += 1;
    const accept = init.headers.get("Accept");
    if (accept === "*/*") {
      return new Response(new Uint8Array([1, 2]), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      });
    }
    return new Response(JSON.stringify({ calls }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const json = await apiGet("/v1/representation", { cache: true, dedupe: false });
  const binary = await apiGet("/v1/representation", { responseType: "arrayBuffer", cache: true, dedupe: false });
  const jsonAgain = await apiGet("/v1/representation", { cache: true, dedupe: false });

  assert.deepEqual(json.data, { calls: 1 });
  assert.deepEqual([...new Uint8Array(binary.data)], [1, 2]);
  assert.equal(calls, 2);
  assert.deepEqual(jsonAgain.data, { calls: 1 });
});


test("cache keys include Headers instances", async () => {
  let calls = 0;
  mockFetch(async (_url, init) => {
    calls += 1;
    return new Response(JSON.stringify({ authorization: init.headers.get("Authorization") }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const first = await apiGet("/v1/header-cache", {
    headers: new Headers({ Authorization: "Bearer first" }),
  });
  const second = await apiGet("/v1/header-cache", {
    headers: new Headers({ Authorization: "Bearer second" }),
  });

  assert.equal(calls, 2);
  assert.equal(first.data.authorization, "Bearer first");
  assert.equal(second.data.authorization, "Bearer second");
});
