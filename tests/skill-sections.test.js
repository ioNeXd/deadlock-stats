// =============================================================================
// UNIT TESTS — js/skill-sections-data.js
// Guards the skill tooltip classification table against regressions:
// duplicate keys, orphan overrides, and accidental mass deletion.
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";

import {
  SKILL_KEY_OVERRIDES,
  SKILL_SECTIONS,
} from "../js/skill-sections-data.js";

const sectionIds = new Set(SKILL_SECTIONS.map((s) => s.id));

test("SKILL_SECTIONS has the expected top-level shape", () => {
  assert.ok(Array.isArray(SKILL_SECTIONS));
  assert.equal(SKILL_SECTIONS.length, 10);

  for (const section of SKILL_SECTIONS) {
    assert.equal(typeof section.id, "string");
    assert.ok(section.id.length > 0);
    assert.ok(["badge", "row"].includes(section.mode), `mode of ${section.id}`);
    assert.equal(typeof section.titleKey, "string");
    assert.ok(Array.isArray(section.css));
    assert.ok(Array.isArray(section.keys));
  }
});

test("SKILL_SECTIONS keys are not duplicated across sections", () => {
  const seen = new Map();
  for (const section of SKILL_SECTIONS) {
    for (const key of section.keys) {
      if (seen.has(key)) {
        assert.fail(
          `key "${key}" appears in both "${seen.get(key)}" and "${section.id}"`,
        );
      }
      seen.set(key, section.id);
    }
  }
});

test("SKILL_KEY_OVERRIDES still covers the full manual table", () => {
  const entries = Object.entries(SKILL_KEY_OVERRIDES);
  assert.ok(
    entries.length >= 100,
    `expected >=100 overrides, got ${entries.length}`,
  );

  for (const [key, sectionId] of entries) {
    assert.ok(key.length > 0, "empty override key");
    assert.ok(
      sectionIds.has(sectionId),
      `override "${key}" maps to unknown section "${sectionId}"`,
    );
  }
});

test("every css class referenced by sections is lowercase", () => {
  for (const section of SKILL_SECTIONS) {
    for (const css of section.css) {
      assert.equal(
        css,
        css.toLowerCase(),
        `css class "${css}" must be lowercase`,
      );
    }
  }
});
