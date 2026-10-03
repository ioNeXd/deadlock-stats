import test from "node:test";
import assert from "node:assert/strict";

import {
  getDashboardCoreSnapshot,
  getDashboardSnapshot,
} from "../src/services/dashboard.js";
import { clearApiCache } from "../src/api/client.js";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  clearApiCache();
});

test("dashboard core snapshot keeps patch feed out of the critical request", async () => {
  const requests = [];
  globalThis.fetch = async input => {
    const url = new URL(input);
    requests.push(url.pathname);
    if (url.pathname === "/v1/info") {
      return new Response(JSON.stringify({
        fetched_matches_per_day: 12345,
        table_sizes: { matches: { rows: 900 } },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify([
      { source: "steam", title: "Older", pub_date: "2026-09-30T10:00:00Z", link: "https://example.test/older" },
      { source: "forum", title: "Latest", pub_date: "2026-10-01T10:00:00Z", link: "https://example.test/latest" },
    ]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const result = await getDashboardCoreSnapshot({ cache: false, dedupe: false });

  assert.deepEqual(requests, ["/v1/info"]);
  assert.equal(result.info.data.fetched_matches_per_day, 12345);
});

test("dashboard full snapshot still composes info and unified v2 patch feed", async () => {
  const requests = [];
  globalThis.fetch = async input => {
    const url = new URL(input);
    requests.push(url.pathname);
    if (url.pathname === "/v1/info") {
      return new Response(JSON.stringify({
        fetched_matches_per_day: 12345,
        table_sizes: { matches: { rows: 900 } },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify([
      { source: "steam", title: "Older", pub_date: "2026-09-30T10:00:00Z", link: "https://example.test/older" },
      { source: "forum", title: "Latest", pub_date: "2026-10-01T10:00:00Z", link: "https://example.test/latest" },
    ]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const result = await getDashboardSnapshot({ cache: false, dedupe: false });

  assert.deepEqual(requests.sort(), ["/v1/info", "/v2/patches"]);
  assert.equal(result.info.data.fetched_matches_per_day, 12345);
  assert.equal(result.latestPatch.title, "Latest");
  assert.equal(result.latestPatch.source, "forum");
});
