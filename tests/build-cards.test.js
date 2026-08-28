// =============================================================================
// UNIT TESTS — js/build-cards.js (pure functions only)
// Uses Node's built-in test runner (node:test), no external dependencies.
// Tests pure functions that do not require DOM.
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveBuildItemFromEntry,
  resolveBuildModCategories,
  getBuildDisplayName,
  safeGetItemMap,
  slotTypeClass,
  isCategoryOptional,
} from "../js/build-cards.js";

// Mock data for testing — raw.shop_image must be set so resolveEntityImage
// can find an icon (otherwise it falls back to placeholder.svg).
const mockItemMap = {
  101: {
    id: 101,
    name: "Test Weapon",
    raw: {
      item_tier: 1,
      item_slot_type: "weapon",
      is_active_item: true,
      infusable: true,
      shop_image: "https://example.com/weapon.png",
    },
  },
  205: {
    id: 205,
    name: "Test Armor",
    raw: {
      item_tier: 2,
      item_slot_type: "vitality",
      is_active_item: false,
      infusable: false,
      shop_image: "https://example.com/armor.png",
    },
  },
};

// -----------------------------------------------------------------------------
// resolveBuildItemFromEntry
// -----------------------------------------------------------------------------

test("resolveBuildItemFromEntry returns null for invalid entry", () => {
  assert.equal(resolveBuildItemFromEntry(null, mockItemMap), null);
  assert.equal(resolveBuildItemFromEntry({}, mockItemMap), null);
  assert.equal(
    resolveBuildItemFromEntry({ ability_id: null }, mockItemMap),
    null,
  );
  assert.equal(resolveBuildItemFromEntry({ item_id: 0 }, mockItemMap), null);
  assert.equal(resolveBuildItemFromEntry({ id: "invalid" }, mockItemMap), null);
});

test("resolveBuildItemFromEntry resolves weapon item correctly", () => {
  const entry = { item_id: 101 };
  const result = resolveBuildItemFromEntry(entry, mockItemMap);
  assert.equal(result.id, 101);
  assert.equal(result.name, "Test Weapon");
  // Icon comes from raw.shop_image via resolveEntityImage
  assert.ok(result.icon.includes("weapon.png"));
  assert.equal(result.tier, 1);
  assert.equal(result.slotType, "weapon");
  assert.equal(result.isActive, true);
  assert.equal(result.canInfuse, true);
});

test("resolveBuildItemFromEntry resolves armor item correctly", () => {
  const entry = { ability_id: 205 };
  const result = resolveBuildItemFromEntry(entry, mockItemMap);
  assert.equal(result.id, 205);
  assert.equal(result.name, "Test Armor");
  // Icon comes from raw.shop_image via resolveEntityImage
  assert.ok(result.icon.includes("armor.png"));
  assert.equal(result.tier, 2);
  assert.equal(result.slotType, "vitality");
  assert.equal(result.isActive, false);
  assert.equal(result.canInfuse, false);
});

test("resolveBuildItemFromEntry falls back to raw name when item not in map", () => {
  const mockMapWithMissing = { ...mockItemMap };
  delete mockMapWithMissing[303]; // Remove item 303

  const entry = { item_id: 303 };
  // Mock item data that would be in raw API response
  const extendedMockMap = {
    ...mockMapWithMissing,
    303: {
      id: 303,
      name: "Fallback Item",
      icon: "assets/placeholder.svg",
      tier: 3,
      slotType: "spirit",
      isActive: false,
      canInfuse: false,
      raw: {
        name: "Fallback Raw Name",
        item_tier: 3,
        item_slot_type: "spirit",
        is_active_item: false,
        infusable: false,
      },
    },
  };

  const result = resolveBuildItemFromEntry(entry, extendedMockMap);
  assert.equal(result.id, 303);
  assert.equal(result.name, "Fallback Item"); // Uses map name
  assert.equal(result.tier, 3);
  assert.equal(result.slotType, "spirit");
});

// -----------------------------------------------------------------------------
// getBuildDisplayName
// -----------------------------------------------------------------------------

test("getBuildDisplayName returns empty string for null/undefined build", () => {
  assert.equal(String(getBuildDisplayName(null)), "");
  assert.equal(String(getBuildDisplayName(undefined)), "");
});

test("getBuildDisplayName returns build.name when present", () => {
  const build = { name: "My Custom Build" };
  assert.equal(getBuildDisplayName(build), "My Custom Build");
});

test("getBuildDisplayName falls back to publishedBuild.name", () => {
  const build = {
    name: "", // empty
    publishedBuild: { name: "Published Build Name" },
  };
  assert.equal(getBuildDisplayName(build), "Published Build Name");
});

test("getBuildDisplayName falls back to actualBuild.name", () => {
  const build = {
    name: "",
    publishedBuild: { name: "" },
    actualBuild: { name: "Actual Build Name" },
  };
  assert.equal(getBuildDisplayName(build), "Actual Build Name");
});

test("getBuildDisplayName returns empty string when all sources empty", () => {
  const build = {
    name: "",
    publishedBuild: { name: "" },
    actualBuild: { name: "" },
  };
  assert.equal(getBuildDisplayName(build), "");
});

// -----------------------------------------------------------------------------
// safeGetItemMap
// -----------------------------------------------------------------------------

test("safeGetItemMap returns empty object for null/undefined", () => {
  assert.deepEqual(safeGetItemMap(null), {});
  assert.deepEqual(safeGetItemMap(undefined), {});
});

test("safeGetItemMap returns empty object for non-object", () => {
  assert.deepEqual(safeGetItemMap("string"), {});
  assert.deepEqual(safeGetItemMap(42), {});
  // Arrays are typeof "object" in JS — safeGetItemMap should reject them
  assert.deepEqual(safeGetItemMap([]), {});
});

test("safeGetItemMap returns the object when valid", () => {
  const obj = { a: 1, b: 2 };
  assert.deepEqual(safeGetItemMap(obj), obj);
});

// -----------------------------------------------------------------------------
// slotTypeClass
// -----------------------------------------------------------------------------

test("slotTypeClass returns correct CSS class for weapon", () => {
  assert.equal(slotTypeClass("weapon"), "build-item-card--weapon");
  assert.equal(slotTypeClass("WEAPON"), "build-item-card--weapon"); // case insensitive
  assert.equal(slotTypeClass("primary_weapon"), "build-item-card--weapon");
});

test("slotTypeClass returns correct CSS class for vitality/armor", () => {
  assert.equal(slotTypeClass("vitality"), "build-item-card--vitality");
  assert.equal(slotTypeClass("armor"), "build-item-card--vitality");
  assert.equal(slotTypeClass("vitality_armor"), "build-item-card--vitality");
});

test("slotTypeClass returns correct CSS class for spirit", () => {
  assert.equal(slotTypeClass("spirit"), "build-item-card--spirit");
  assert.equal(slotTypeClass("SPIRIT"), "build-item-card--spirit");
});

test("slotTypeClass returns correct CSS class for utility", () => {
  assert.equal(slotTypeClass("utility"), "build-item-card--utility");
  assert.equal(slotTypeClass("active_utility"), "build-item-card--utility");
});

test("slotTypeClass returns unknown for unrecognized slot types", () => {
  assert.equal(slotTypeClass("unknown"), "build-item-card--unknown");
  assert.equal(slotTypeClass(""), "build-item-card--unknown");
  assert.equal(slotTypeClass(null), "build-item-card--unknown");
});

// -----------------------------------------------------------------------------
// isCategoryOptional
// -----------------------------------------------------------------------------

test("isCategoryOptional returns true for explicit true flag", () => {
  assert.equal(isCategoryOptional({ optional: true }, "Any Name"), true);
  assert.equal(isCategoryOptional({ optional: 1 }, "Any Name"), true);
  assert.equal(isCategoryOptional({ optional: "1" }, "Any Name"), true);
});

test("isCategoryOptional returns true for optional keywords in name", () => {
  assert.equal(isCategoryOptional({}, "Optional Category"), true);
  assert.equal(isCategoryOptional({}, "opcional"), true); // Portuguese
  assert.equal(isCategoryOptional({}, "OPCIONAL"), true);
  assert.equal(isCategoryOptional({}, "Optional"), true);
});

test("isCategoryOptional returns false when not optional", () => {
  assert.equal(isCategoryOptional({ optional: false }, "Required"), false);
  assert.equal(isCategoryOptional({}, "Required Slot"), false);
  assert.equal(isCategoryOptional({ optional: 0 }, "Slot"), false);
});

// -----------------------------------------------------------------------------
// resolveBuildModCategories
// -----------------------------------------------------------------------------

test("resolveBuildModCategories returns empty array for null/undefined build", () => {
  assert.deepEqual(resolveBuildModCategories(null), []);
  assert.deepEqual(resolveBuildModCategories(undefined), []);
});

test("resolveBuildModCategories returns empty array for non-object", () => {
  assert.deepEqual(resolveBuildModCategories("string"), []);
  assert.deepEqual(resolveBuildModCategories(42), []);
  assert.deepEqual(resolveBuildModCategories([]), []);
});

test("resolveBuildModCategories extracts modCategories from build", () => {
  const build = {
    publishedBuild: {
      hero_build: {
        details: {
          mod_categories: [
            { name: "Offense", mods: [{ ability_id: 101 }] },
            { name: "Defense", mods: [{ item_id: 205 }] },
          ],
        },
      },
    },
  };

  const result = resolveBuildModCategories(build);
  assert.equal(result.length, 2);
  assert.equal(result[0].name, "Offense");
  assert.equal(result[1].name, "Defense");
});

test("resolveBuildModCategories falls back through multiple sources", () => {
  const build = {
    // No publishedBuild or hero_build
    actualBuild: {
      build: {
        details: {
          mod_categories: [
            { name: "Fallback Source", mods: [{ ability_id: 101 }] },
          ],
        },
      },
    },
  };

  const result = resolveBuildModCategories(build);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Fallback Source");
});

test("resolveBuildModCategories handles direct mod_categories on source", () => {
  const build = {
    actualBuild: {
      mod_categories: [{ name: "Direct Category", mods: [{ item_id: 205 }] }],
    },
  };

  const result = resolveBuildModCategories(build);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Direct Category");
});
