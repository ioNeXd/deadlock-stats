// =============================================================================
// UNIT TESTS — js/api.js (pure helpers only; no network calls)
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";

import {
  extractAbilityStats,
  extractList,
  localAssetUrl,
  normalizeBuildPayload,
  normalizeHeroBuildStats,
  resolveEntityImage,
  sanitizeAbilityDescription,
} from "../js/api.js";

// -----------------------------------------------------------------------------
// extractList
// -----------------------------------------------------------------------------

test("extractList handles the common API response shapes", () => {
  assert.deepEqual(extractList([1, 2, 3]), [1, 2, 3]);
  assert.deepEqual(extractList({ value: [1, 2] }), [1, 2]);
  assert.deepEqual(extractList({ data: [1, 2] }), [1, 2]);
  assert.deepEqual(extractList({}), []);
  assert.deepEqual(extractList(null), []);
  assert.deepEqual(extractList(undefined), []);
});

// -----------------------------------------------------------------------------
// localAssetUrl / resolveEntityImage
// -----------------------------------------------------------------------------

test("localAssetUrl maps CDN stat icons to local assets", () => {
  const cdn =
    "https://assets-bucket.deadlock-api.com/assets-api-res/icons/cooldown.svg";
  assert.equal(localAssetUrl(cdn), "assets/icons/stats/cooldown.svg");
  assert.equal(
    localAssetUrl("https://other.cdn/img.png"),
    "https://other.cdn/img.png",
  );
  assert.equal(localAssetUrl(null), null);
  assert.equal(localAssetUrl(""), "");
});

test("resolveEntityImage follows the fallback chain in order", () => {
  assert.equal(resolveEntityImage(null, "fb"), "fb");

  const withWebp = { raw: { shop_image_webp: "webp", shop_image: "png" } };
  assert.equal(resolveEntityImage(withWebp), "webp");

  const withImages = {
    images: { icon_image_small: "small.png", icon: "icon.png" },
  };
  assert.equal(resolveEntityImage(withImages), "small.png");

  const withEntityField = { shop_image: "shop.png" };
  assert.equal(resolveEntityImage(withEntityField), "shop.png");

  const empty = { raw: {}, images: {} };
  assert.equal(resolveEntityImage(empty, "fb"), "fb");
});

// -----------------------------------------------------------------------------
// normalizeBuildPayload
// -----------------------------------------------------------------------------

test("normalizeBuildPayload extracts hero_build + details + ability order", () => {
  const raw = {
    hero_build: {
      hero_build_id: 42,
      name: "Molten Fury",
      version: 3,
      tags: ["lane"],
    },
    details: {
      mod_categories: [{ name: "Early" }, { name: "Late" }],
      ability_order: {
        currency_changes: [{ type: "skill", id: 0 }, { type: "upgrade" }],
      },
    },
    num_favorites: 10,
  };

  const out = normalizeBuildPayload(raw);
  assert.equal(out.hero_build_id, 42);
  assert.equal(out.name, "Molten Fury");
  assert.equal(out.version, 3);
  assert.equal(out.details.mod_categories.length, 2);
  assert.equal(out.details.ability_order.currency_changes.length, 2);
  assert.equal(out.num_favorites, 10);
});

test("normalizeBuildPayload accepts a bare build object and rejects garbage", () => {
  const bare = {
    id: 7,
    name: "Bare",
    details: { mod_categories: [] },
  };
  const out = normalizeBuildPayload(bare);
  assert.equal(out.hero_build_id, 7);
  assert.equal(out.name, "Bare");
  assert.deepEqual(out.details.mod_categories, []);

  assert.equal(normalizeBuildPayload(null), null);
  assert.equal(normalizeBuildPayload("nope"), null);

  // Empty object is a valid (empty) build shell, not an error.
  const shell = normalizeBuildPayload({});
  assert.equal(shell.hero_build_id, null);
  assert.deepEqual(shell.details.mod_categories, []);
  assert.deepEqual(shell.details.ability_order.currency_changes, []);
});

// -----------------------------------------------------------------------------
// normalizeHeroBuildStats
// -----------------------------------------------------------------------------

test("normalizeHeroBuildStats computes win rate and standardizes ids", () => {
  const raw = [
    { hero_build_id: 1, wins: 25, matches: 100 },
    { build_id: 2, wins: 0, matches: 0 },
  ];
  const out = normalizeHeroBuildStats(raw);
  assert.equal(out[0].buildId, 1);
  assert.equal(out[0].winRate, 25);
  assert.equal(out[1].winRate, 0, "zero matches must not produce NaN");
  assert.equal(normalizeHeroBuildStats(null).length, 0);
  assert.equal(normalizeHeroBuildStats("x").length, 0);
});

// -----------------------------------------------------------------------------
// sanitizeAbilityDescription
// -----------------------------------------------------------------------------

test("sanitizeAbilityDescription strips SVG/panels/tags and normalizes breaks", () => {
  const svgAndBr = '<svg><path/></svg><Panel>x</Panel><b>Napalm</b><br/>ignites enemies';
  assert.equal(sanitizeAbilityDescription(svgAndBr), "Napalm\nignites enemies");

  const paragraphs = '<p>First paragraph.</p><p>Second.</p>';
  assert.equal(sanitizeAbilityDescription(paragraphs), "First paragraph.\nSecond.");

  assert.equal(sanitizeAbilityDescription(""), "");
  assert.equal(sanitizeAbilityDescription(null), "");
});

// -----------------------------------------------------------------------------
// extractAbilityStats
// -----------------------------------------------------------------------------

test("extractAbilityStats filters empties, appends postfix and sorts by priority", () => {
  const properties = {
    AbilityCooldown: { label: "Cooldown", value: "28.0", postfix: "s", css_class: "cooldown" },
    Damage: { label: "Damage", value: "40", css_class: "tech_damage" },
    Empty: { label: "None", value: "x", css_class: "" },
    Zero: { label: "Zero", value: "0", css_class: "" },
  };
  const out = extractAbilityStats(properties);
  assert.equal(out.length, 2);
  assert.equal(out[0].key, "AbilityCooldown", "cooldown has top priority");
  assert.equal(out[0].value, "28.0s", "postfix appended");
  assert.equal(out[1].key, "Damage");
  assert.equal(out[1].value, "40");

  assert.deepEqual(extractAbilityStats(null), []);
  assert.deepEqual(extractAbilityStats({}), []);
});
