import test from "node:test";
import assert from "node:assert/strict";

import {
  getDashboardCoreSnapshot,
  getDashboardSnapshot,
  normalizeMajorPatch,
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

    if (url.pathname === "/v1/patches/big-days") {
      return new Response(JSON.stringify(["2026-10-01T10:00:00Z"]), {
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

  assert.deepEqual(requests.sort(), ["/v1/info", "/v1/patches/big-days", "/v2/patches"]);
  assert.equal(result.info.data.fetched_matches_per_day, 12345);
  assert.equal(result.latestPatch.title, "Latest");
  assert.equal(result.latestPatch.source, "forum");
  assert.equal(result.latestMajorPatch.title, "Latest");
});


test("dashboard activity snapshot uses daily game statistics", async () => {
  let requestedUrl;
  globalThis.fetch = async input => {
    requestedUrl = String(input);
    return new Response(JSON.stringify([
      { bucket: "2026-10-02", total_matches: 1200, total_players: 14400 },
    ]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const { getDashboardActivitySnapshot } = await import("../src/services/dashboard.js");
  const result = await getDashboardActivitySnapshot({ cache: false, dedupe: false });
  const url = new URL(requestedUrl);
  assert.equal(url.pathname, "/v1/analytics/game-stats");
  assert.equal(url.searchParams.get("bucket"), "start_time_day");
  assert.equal(result.activity[0].total_matches, 1200);
});


test("dashboard major update follows the API-maintained big patch calendar", () => {
  const patches = [
    { source: "steam", title: "Steam news", pub_date: "2026-10-03T10:00:00Z" },
    { source: "forum", title: "Major Update", pub_date: "2026-10-01T18:00:00Z" },
    { source: "forum", title: "Hotfix", pub_date: "2026-10-02T18:00:00Z" },
  ];
  const bigDays = ["2026-09-20T15:00:00Z", "2026-10-01T18:00:00Z"];

  const result = normalizeMajorPatch(
    patches,
    bigDays,
    Date.parse("2026-10-04T12:00:00Z"),
  );

  assert.equal(result?.title, "Major Update");
  assert.equal(result?.source, "forum");
});

test("dashboard major update does not mistake Steam news for a major patch", () => {
  const result = normalizeMajorPatch(
    [{ source: "steam", title: "Steam news", pub_date: "2026-10-01T10:00:00Z" }],
    ["2026-10-01T10:00:00Z"],
    Date.parse("2026-10-04T12:00:00Z"),
  );

  assert.equal(result, null);
});
