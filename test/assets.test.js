import assert from "node:assert/strict";
import test from "node:test";

import { clearApiCache } from "../src/api/client.js";
import { getHeroes, getRankSubrankImage, getMap, getColors } from "../src/api/assets.js";
import { normalizeCollection, resolveAssetImage } from "../src/adapters/assets.js";

function mockJsonResponse(value, contentType = "application/json") {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": contentType },
  });
}

test.beforeEach(() => {
  clearApiCache();
});

test("asset list helpers forward language, client version and endpoint-specific filters", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async url => {
    calls.push(new URL(url));
    return mockJsonResponse([]);
  };

  try {
    await getHeroes({
      language: "portuguese",
      clientVersion: 6712,
      onlyActive: true,
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].pathname, "/v1/assets/heroes");
    assert.equal(calls[0].searchParams.get("language"), "portuguese");
    assert.equal(calls[0].searchParams.get("client_version"), "6712");
    assert.equal(calls[0].searchParams.get("only_active"), "true");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("versioned asset endpoints preserve explicit query options", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async url => {
    calls.push(new URL(url));
    return mockJsonResponse({});
  };

  try {
    await getMap({ clientVersion: 6712, query: { extra: "kept" } });
    await getColors({ clientVersion: 6712 });

    assert.equal(calls[0].pathname, "/v1/assets/map");
    assert.equal(calls[0].searchParams.get("client_version"), "6712");
    assert.equal(calls[0].searchParams.get("extra"), "kept");
    assert.equal(calls[1].pathname, "/v1/assets/colors");
    assert.equal(calls[1].searchParams.get("client_version"), "6712");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("binary rank asset requests default to blob parsing and support webp", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async url => {
    const requestUrl = new URL(url);
    assert.equal(requestUrl.pathname, "/v1/assets/ranks/3/2/image");
    assert.equal(requestUrl.searchParams.get("format"), "webp");
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/webp" },
    });
  };

  try {
    const result = await getRankSubrankImage(3, 2, { format: "webp" });
    assert.ok(result.data instanceof Blob);
    assert.equal(result.contentType, "image/webp");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("asset normalization preserves raw data and known image fields while tolerating unknown fields", () => {
  const raw = [{
    id: 7,
    name: "Example",
    background_image_webp: "https://cdn.example/background.webp",
    class_name: "hero_example",
    colors: { hero_color: "#ffffff" },
    future_field: { nested: true },
  }];

  const normalized = normalizeCollection(raw);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].id, 7);
  assert.equal(normalized[0].name, "Example");
  assert.equal(normalized[0].className, "hero_example");
  assert.deepEqual(normalized[0].colors, { hero_color: "#ffffff" });
  assert.equal(normalized[0].images.background_image_webp, raw[0].background_image_webp);
  assert.deepEqual(normalized[0].raw, raw[0]);
  assert.deepEqual(normalized[0].raw.future_field, { nested: true });
});


test("asset image resolution prefers explicit fields and falls back across official asset fields", () => {
  const entity = {
    images: {
      background_image: "https://cdn.example/background.jpg",
      image_webp: "https://cdn.example/item.webp",
    },
  };

  assert.equal(
    resolveAssetImage(entity, ["image_webp", "background_image"]),
    "https://cdn.example/item.webp",
  );
  assert.equal(
    resolveAssetImage({ raw: { images: { icon: "https://cdn.example/icon.png" } } }),
    "https://cdn.example/icon.png",
  );
});

test("map normalization preserves API layers and optional build-specific fields", () => {
  const raw = {
    radius: 1234,
    images: { minimap: "https://cdn.example/minimap.png", mid: "https://cdn.example/mid.png", plain: "https://cdn.example/plain.png", frame: "https://cdn.example/frame.png", background: null },
    objective_positions: { patron: { left_relative: 0.1, top_relative: 0.2 } },
    zipline_paths: [{ origin: [1, 2, 3], color: "#fff", color_parsed: { r: 255, g: 255, b: 255, a: 1 }, P0_points: [], P1_points: [], P2_points: [] }],
    neutral_camps: null,
    entities: null,
    future_field: { preserved: true },
  };
  const normalized = normalizeMap(raw);
  assert.equal(normalized.radius, 1234);
  assert.equal(normalized.images.mid, raw.images.mid);
  assert.deepEqual(normalized.objectivePositions, raw.objective_positions);
  assert.equal(normalized.ziplinePaths.length, 1);
  assert.equal(normalized.neutralCamps, null);
  assert.equal(normalized.entities, null);
  assert.deepEqual(normalized.raw.future_field, { preserved: true });
});
