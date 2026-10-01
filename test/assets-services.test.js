import test from "node:test";
import assert from "node:assert/strict";

import { listHeroes, fetchHero, listRanks, listItems } from "../src/services/assets.js";
import { clearApiCache } from "../src/api/client.js";

const originalFetch = globalThis.fetch;

function mockFetch(payload, { status = 200, contentType = "application/json" } = {}) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    return new Response(
      contentType === "application/json" ? JSON.stringify(payload) : String(payload),
      {
        status,
        headers: { "content-type": contentType },
      },
    );
  };
  return calls;
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  clearApiCache();
});

test("listHeroes preserves raw payload and normalizes collection data", async () => {
  const payload = {
    data: [
      {
        id: 101,
        name: "Test Hero",
        images: { hero_card_critical_webp: "https://example.test/hero.webp" },
        future_field: "preserved only in raw",
      },
    ],
  };
  const calls = mockFetch(payload);

  const result = await listHeroes({ cache: false, dedupe: false });

  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).pathname, "/v1/assets/heroes");
  assert.deepEqual(result.raw, payload);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].id, 101);
  assert.equal(result.data[0].name, "Test Hero");
  assert.equal(result.data[0].images.hero_card_critical_webp, "https://example.test/hero.webp");
  assert.equal(result.data[0].raw.future_field, "preserved only in raw");
});

test("listHeroes accepts a direct array response", async () => {
  const payload = [{ id: 7, name: "Array Hero" }];
  mockFetch(payload);

  const result = await listHeroes({ cache: false, dedupe: false });

  assert.deepEqual(result.raw, payload);
  assert.deepEqual(result.data[0], {
    id: 7,
    name: "Array Hero",
    images: {},
    raw: payload[0],
  });
});

test("fetchHero uses the dedicated hero endpoint and normalizes the detail", async () => {
  const payload = {
    id: 12,
    display_name: "Detail Hero",
    background_image: "https://example.test/background.webp",
    unknown_field: { enabled: true },
  };
  const calls = mockFetch(payload);

  const result = await fetchHero(12, { cache: false, dedupe: false });

  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).pathname, "/v1/assets/heroes/12");
  assert.deepEqual(result.raw, payload);
  assert.equal(result.data.id, 12);
  assert.equal(result.data.name, "Detail Hero");
  assert.equal(result.data.images.background_image, "https://example.test/background.webp");
  assert.equal(result.data.raw.unknown_field.enabled, true);
});

test("listRanks and listItems return normalized collections", async () => {
  let calls = mockFetch([{ tier: 1, name: "Rank One" }]);
  const ranks = await listRanks({ cache: false, dedupe: false });
  assert.equal(new URL(calls[0].url).pathname, "/v1/assets/ranks");
  assert.equal(ranks.data[0].id, 1);

  calls = mockFetch([{ item_id: 55, item_name: "Test Item", icon: "https://example.test/item.png" }]);
  const items = await listItems({ cache: false, dedupe: false });
  assert.equal(new URL(calls[0].url).pathname, "/v1/assets/items");
  assert.equal(items.data[0].id, 55);
  assert.equal(items.data[0].name, "Test Item");
  assert.equal(items.data[0].images.icon, "https://example.test/item.png");
});
