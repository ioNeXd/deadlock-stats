import assert from "node:assert/strict";
import test from "node:test";

import { clearApiCache } from "../src/api/client.js";
import { getHeroes, getItems, getItemsByHeroId, getItemsBySlotType, getItemsByType, getItem, getRankSubrankImage, getMap, getColors } from "../src/api/assets.js";
import { normalizeCollection, normalizeMap, resolveAssetImage } from "../src/adapters/assets.js";

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

test("item asset helpers use the current documented item endpoints", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async input => {
    calls.push(new URL(input));
    return mockJsonResponse([]);
  });

  await getItems({ language: "english", clientVersion: 6712, cache: false, dedupe: false });
  await getItemsByHeroId(7, { cache: false, dedupe: false });
  await getItemsBySlotType("weapon", { cache: false, dedupe: false });
  await getItemsByType("ability", { cache: false, dedupe: false });
  await getItem("item_test", { cache: false, dedupe: false });

  assert.deepEqual(calls.map(url => url.pathname), [
    "/v1/assets/items",
    "/v1/assets/items/by-hero-id/7",
    "/v1/assets/items/by-slot-type/weapon",
    "/v1/assets/items/by-type/ability",
    "/v1/assets/items/item_test",
  ]);
  assert.equal(calls[0].searchParams.get("language"), "english");
  assert.equal(calls[0].searchParams.get("client_version"), "6712");
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
  assert.equal(normalized.ziplinePaths[0].segments.length, 0);
});

test("map normalization preserves legacy background and optional modern map layers", () => {
  const legacy = normalizeMap({
    radius: 100,
    images: {
      background: "https://cdn.example/background.png",
      minimap: "https://cdn.example/minimap.png",
      plain: "https://cdn.example/plain.png",
      frame: "https://cdn.example/frame.png",
      mid: "https://cdn.example/mid.png",
      mid_tunnels: null,
      rat_tunnels: null,
    },
    objective_positions: {},
    zipline_paths: [],
    neutral_camps: null,
    entities: null,
  });

  assert.equal(legacy.images.background, "https://cdn.example/background.png");
  assert.equal(legacy.neutralCamps, null);
  assert.equal(legacy.entities, null);

  const modern = normalizeMap({
    radius: 100,
    images: {
      background: null,
      minimap: "https://cdn.example/minimap.png",
      plain: "https://cdn.example/plain.png",
      frame: "https://cdn.example/frame.png",
      mid: "https://cdn.example/mid.png",
      mid_tunnels: "https://cdn.example/mid-tunnels.png",
      rat_tunnels: "https://cdn.example/rat-tunnels.png",
    },
    objective_positions: {},
    zipline_paths: [],
    neutral_camps: [{ name: "Camp A", left_relative: 0.2, top_relative: 0.3 }],
    entities: { shops: [{ left_relative: 0.4, top_relative: 0.5, position: [0, 0, 0], top_relative: 0.5 }] },
  });

  assert.equal(modern.images.background, null);
  assert.equal(modern.images.mid_tunnels, "https://cdn.example/mid-tunnels.png");
  assert.equal(modern.images.rat_tunnels, "https://cdn.example/rat-tunnels.png");
  assert.equal(modern.neutralCamps.length, 1);
  assert.equal(modern.entities.shops.length, 1);
});

test("map normalization converts origin-relative zipline splines to minimap coordinates", () => {
  const normalized = normalizeMap({
    radius: 100,
    images: {},
    objective_positions: {},
    zipline_paths: [{
      origin: [0, 0, 0],
      color: "#fff",
      color_parsed: { r: 255, g: 255, b: 255, a: 1 },
      P0_points: [[-50, -50, 0], [0, 0, 0]],
      P1_points: [[-50, -50, 0], [0, 0, 0]],
      P2_points: [[-25, -25, 0], [0, 0, 0]],
    }],
  });

  assert.deepEqual(normalized.ziplinePaths[0].segments, [{
    start: [0.25, 0.75],
    control1: [0.375, 0.625],
    control2: [0.5, 0.5],
    end: [0.5, 0.5],
  }]);
});

test("map normalization applies zipline origin to relative spline points", () => {
  const normalized = normalizeMap({
    radius: 100,
    images: {},
    objective_positions: {},
    zipline_paths: [{
      origin: [50, -50, 0],
      color: "#fff",
      color_parsed: { r: 255, g: 255, b: 255, a: 1 },
      P0_points: [[-50, -50, 0], [0, 0, 0]],
      P1_points: [[-50, -50, 0], [0, 0, 0]],
      P2_points: [[-25, -25, 0], [0, 0, 0]],
    }],
  });

  assert.deepEqual(normalized.ziplinePaths[0].segments, [{
    start: [0.5, 1],
    control1: [0.625, 0.875],
    control2: [0.75, 0.75],
    end: [0.75, 0.75],
  }]);
});
